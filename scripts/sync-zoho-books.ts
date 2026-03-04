/**
 * Sync Zoho Books items into the database.
 *
 * Two modes:
 * 1. Direct (recommended on server): ZOHO_SYNC_DIRECT=1 npm run zoho:sync
 *    Runs the sync in-process; no HTTP call. Use when the script runs on the same machine as the app
 *    (avoids connection timeouts to the public URL).
 * 2. Via API: npm run zoho:sync (no ZOHO_SYNC_DIRECT)
 *    Calls POST /api/zoho/sync. Requires ZOHO_SYNC_CRON_SECRET and the app to be reachable (e.g. localhost).
 */
import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local" });

const baseUrl = process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000";
const secret = process.env.ZOHO_SYNC_CRON_SECRET?.trim();
const direct = process.env.ZOHO_SYNC_DIRECT === "1" || process.env.ZOHO_SYNC_DIRECT === "true";

async function main() {
  if (direct) {
    console.log("Running Zoho Books sync directly (ZOHO_SYNC_DIRECT=1)...");
    const { syncZohoBooksItemsToDb } = await import("../src/lib/zoho-sync");
    const result = await syncZohoBooksItemsToDb();
    if (result.ok) {
      console.log("OK: Zoho Books items synced, count:", result.syncedCount ?? 0);
      return;
    }
    console.error("Sync failed:", result.error);
    process.exit(1);
  }

  if (!secret) {
    console.error("Set ZOHO_SYNC_CRON_SECRET in .env and run again.");
    console.error("Or run sync directly on the server (no HTTP): ZOHO_SYNC_DIRECT=1 npm run zoho:sync");
    process.exit(1);
  }

  const url = baseUrl.replace(/\/$/, "") + "/api/zoho/sync";
  console.log("Calling", url, "...");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: "Bearer " + secret },
    });
    const data = (await res.json()) as { success?: boolean; error?: string; syncedCount?: number; message?: string };

    if (res.ok && data.success) {
      console.log("OK:", data.message ?? "Synced", "count:", data.syncedCount ?? 0);
      return;
    }
    console.error("Sync failed:", data.error ?? res.status, data);
    process.exit(1);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Request failed:", msg);
    console.error("");
    console.error("If you're on the same server as the app, run without calling the URL:");
    console.error("  ZOHO_SYNC_DIRECT=1 npm run zoho:sync");
    process.exit(1);
  }
}

main();
