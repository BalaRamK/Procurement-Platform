import { query, queryClient, queryOne, withTransaction } from "@/lib/db";
import { graphGet } from "@/lib/graph";
import { getDelegatedAccessToken } from "@/lib/production-status-auth";

/**
 * Daily sync of the "Production Status" Excel workbook (SharePoint/OneDrive) into the database.
 * Each sheet row is stored as JSON keyed by its column header, so the dashboard can be built on top
 * without a fixed schema. The table is replaced in one transaction; a failed sync keeps the last good data.
 *
 * Where the file lives (env):
 *   PRODUCTION_STATUS_FILE_NAME   e.g. "Production Status.xlsx"
 *   PRODUCTION_STATUS_DRIVE_USER  e.g. jithesh_t@qnulabs.com  (file in that user's OneDrive), or
 *   PRODUCTION_STATUS_DRIVE_ID    a SharePoint document library drive id (takes priority)
 *   PRODUCTION_STATUS_SHEET_NAME  optional; defaults to the first sheet
 */
export type ProductionStatusSyncResult =
  | { ok: true; rowCount: number; sheetName: string; sourceModifiedAt: string | null }
  | { ok: false; error: string };

export async function ensureProductionStatusTables() {
  await query(`CREATE TABLE IF NOT EXISTS production_status_rows (
    sheet_name TEXT NOT NULL,
    row_number INTEGER NOT NULL,
    data JSONB NOT NULL,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (sheet_name, row_number)
  )`);
  await query(`CREATE TABLE IF NOT EXISTS production_status_sync (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    last_attempt_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_status TEXT,
    last_error TEXT,
    row_count INTEGER,
    sheet_name TEXT,
    source_modified_at TIMESTAMPTZ
  )`);
}

export async function getProductionStatusSyncInfo() {
  await ensureProductionStatusTables();
  return queryOne<{
    lastAttemptAt: string | null;
    lastSuccessAt: string | null;
    lastStatus: string | null;
    lastError: string | null;
    rowCount: number | null;
    sheetName: string | null;
    sourceModifiedAt: string | null;
  }>(`SELECT last_attempt_at, last_success_at, last_status, last_error, row_count, sheet_name, source_modified_at
      FROM production_status_sync WHERE id = 1`);
}

async function locateWorkbook(userToken: string | null): Promise<{ downloadPath: string; modifiedAt: string | null }> {
  const fileName = process.env.PRODUCTION_STATUS_FILE_NAME?.trim();
  const driveId = process.env.PRODUCTION_STATUS_DRIVE_ID?.trim();
  const driveUser = process.env.PRODUCTION_STATUS_DRIVE_USER?.trim();
  if (!fileName || (!userToken && !driveId && !driveUser)) {
    throw new Error(
      "Set PRODUCTION_STATUS_FILE_NAME and connect the workbook owner's Microsoft account " +
        "(/api/production-status/connect), or set PRODUCTION_STATUS_DRIVE_USER / PRODUCTION_STATUS_DRIVE_ID for app-only access."
    );
  }
  // A connected account reads its own OneDrive; otherwise use app-only access to the configured drive.
  const base = userToken
    ? "/me/drive"
    : driveId
      ? `/drives/${encodeURIComponent(driveId)}`
      : `/users/${encodeURIComponent(driveUser!)}/drive`;
  const res = await graphGet(
    `${base}/root/search(q='${fileName.replace(/'/g, "''")}')?$select=id,name,lastModifiedDateTime,file`,
    userToken ?? undefined
  );
  if (!res.ok) throw new Error(`Graph file search failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { value: { id: string; name: string; lastModifiedDateTime?: string; file?: object }[] };
  const matches = json.value.filter((item) => item.file && item.name.toLowerCase() === fileName.toLowerCase());
  if (matches.length === 0) throw new Error(`File "${fileName}" not found in that drive.`);
  if (matches.length > 1) {
    console.warn(`[production-status] ${matches.length} files named "${fileName}"; using the most recently modified.`);
  }
  matches.sort((a, b) => (b.lastModifiedDateTime ?? "").localeCompare(a.lastModifiedDateTime ?? ""));
  const item = matches[0];
  return { downloadPath: `${base}/items/${encodeURIComponent(item.id)}/content`, modifiedAt: item.lastModifiedDateTime ?? null };
}

async function recordResult(
  status: "ok" | "error",
  fields: { error?: string; rowCount?: number; sheetName?: string; sourceModifiedAt?: string | null }
) {
  await query(
    `INSERT INTO production_status_sync (id, last_attempt_at, last_success_at, last_status, last_error, row_count, sheet_name, source_modified_at)
     VALUES (1, now(), CASE WHEN $1 = 'ok' THEN now() END, $1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       last_attempt_at = now(),
       last_success_at = CASE WHEN $1 = 'ok' THEN now() ELSE production_status_sync.last_success_at END,
       last_status = $1,
       last_error = $2,
       row_count = COALESCE($3, production_status_sync.row_count),
       sheet_name = COALESCE($4, production_status_sync.sheet_name),
       source_modified_at = COALESCE($5, production_status_sync.source_modified_at)`,
    [status, fields.error ?? null, fields.rowCount ?? null, fields.sheetName ?? null, fields.sourceModifiedAt ?? null]
  );
}

export async function syncProductionStatusToDb(): Promise<ProductionStatusSyncResult> {
  try {
    const startedAt = Date.now();
    const step = (name: string) => console.log(`[production-status sync] ${name} (+${Date.now() - startedAt} ms)`);
    await ensureProductionStatusTables();
    const userToken = await getDelegatedAccessToken(); // null when no account is connected
    step(userToken ? "got delegated token" : "no connected account; using app-only access");
    const { downloadPath, modifiedAt } = await locateWorkbook(userToken);
    step("workbook located");
    const fileRes = await graphGet(downloadPath, userToken ?? undefined);
    if (!fileRes.ok) throw new Error(`Workbook download failed: ${fileRes.status} ${await fileRes.text()}`);
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    step(`workbook downloaded (${buffer.length} bytes)`);

    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const wanted = process.env.PRODUCTION_STATUS_SHEET_NAME?.trim();
    const sheetName = wanted || workbook.SheetNames[0];
    const worksheet = sheetName ? workbook.Sheets[sheetName] : undefined;
    if (!worksheet) throw new Error(`Sheet "${wanted ?? "(first)"}" not found. Sheets: ${workbook.SheetNames.join(", ")}`);

    // Row 1 is the header; fully blank rows are skipped.
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: null });
    if (rows.length === 0) throw new Error(`Sheet "${sheetName}" has no data rows; keeping the existing data.`);

    await withTransaction(async (client) => {
      await queryClient(client, `DELETE FROM production_status_rows WHERE sheet_name = $1`, [sheetName]);
      const BATCH = 200;
      for (let start = 0; start < rows.length; start += BATCH) {
        const chunk = rows.slice(start, start + BATCH);
        const placeholders = chunk.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3}::jsonb)`).join(", ");
        const params: unknown[] = [sheetName];
        chunk.forEach((row, i) => params.push(start + i + 2, JSON.stringify(row))); // +2: header is row 1
        await queryClient(client, `INSERT INTO production_status_rows (sheet_name, row_number, data) VALUES ${placeholders}`, params);
      }
    });

    await recordResult("ok", { rowCount: rows.length, sheetName, sourceModifiedAt: modifiedAt });
    return { ok: true, rowCount: rows.length, sheetName, sourceModifiedAt: modifiedAt };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[production-status sync]", message);
    try {
      await recordResult("error", { error: message.slice(0, 1000) });
    } catch {
      // ignore: the original error is what matters
    }
    return { ok: false, error: message };
  }
}
