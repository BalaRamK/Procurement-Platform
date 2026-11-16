import { query } from "@/lib/db";
import { ensureProductionStatusTables } from "@/lib/production-status-sync";

/** One system/line from the Production Status sheet, normalised from the stored JSON row. */
export type ProductionStatusRow = {
  rowNumber: number;
  slNo: string;
  systemId: string;
  productType: string;
  customer: string;
  requestedDate: string | null; // YYYY-MM-DD
  expectedDate: string | null;
  deliveredDate: string | null;
  status: string;
  remarks: string;
};

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Find a value by header, ignoring case/punctuation; a header may continue after the wanted name ("customer" matches "Customer Name/..."). */
function field(data: Record<string, unknown>, ...names: string[]) {
  const wanted = names.map(norm);
  for (const [key, value] of Object.entries(data)) {
    const nk = norm(key);
    if (wanted.some((w) => nk === w || nk.startsWith(w))) return value;
  }
  return undefined;
}

const text = (value: unknown) => (value == null ? "" : String(value).trim());

function toIsoDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel serial date
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = Date.parse(s);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString().slice(0, 10);
}

export async function getProductionStatusRows(): Promise<ProductionStatusRow[]> {
  await ensureProductionStatusTables();
  const rows = await query<{ rowNumber: number; data: Record<string, unknown> }>(
    `SELECT row_number, data FROM production_status_rows ORDER BY row_number`
  );
  const out: ProductionStatusRow[] = [];
  for (const { rowNumber, data } of rows) {
    const row: ProductionStatusRow = {
      rowNumber,
      slNo: text(field(data, "slno", "sno", "serial")),
      systemId: text(field(data, "systemid")),
      productType: text(field(data, "producttype")),
      customer: text(field(data, "customer")),
      requestedDate: toIsoDate(field(data, "requesteddate")),
      expectedDate: toIsoDate(field(data, "expecteddateofdelivery", "expecteddelivery")),
      deliveredDate: toIsoDate(field(data, "delivereddate")),
      status: text(field(data, "status")),
      remarks: text(field(data, "remarks")),
    };
    if (row.systemId || row.customer || row.status || row.productType) out.push(row);
  }
  return out;
}

/** Today's date (YYYY-MM-DD) in India time, so "delayed" matches the team's calendar day. */
export function todayInIndia() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
