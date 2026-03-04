/**
 * Sync Zoho Books items into the database.
 * Run once to seed: npx tsx scripts/sync-zoho-books.ts
 * Or call POST /api/zoho/sync (with ZOHO_SYNC_CRON_SECRET or as SUPER_ADMIN) weekly via cron.
 *
 * This script calls the app's sync API so the app must be running, or use curl/cron against your deployed URL.
 */
import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local" });

const baseUrl = process.env.NEXTAUTH_URL?.trim() || "http://localhost:3000";
const secret = process.env.ZOHO_SYNC_CRON_SECRET?.trim();

async function main() {
  if (!secret) {
    console.error("Set ZOHO_SYNC_CRON_SECRET in .env and run again.");
    console.error("Or run sync as SUPER_ADMIN: curl -X POST " + baseUrl + "/api/zoho/sync (when signed in).");
    process.exit(1);
  }

  const url = baseUrl.replace(/\/$/, "") + "/api/zoho/sync";
  console.log("Calling", url, "...");

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
}

main();
