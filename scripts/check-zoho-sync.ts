/**
 * Check Zoho Books sync: row count, latest sync time, and sample rows.
 * Usage: npx tsx scripts/check-zoho-sync.ts  (or npm run zoho:check)
 */
import { config } from "dotenv";
import { query, queryOne } from "../src/lib/db";

config({ path: ".env" });
config({ path: ".env.local" });

async function main() {
  const tableExists = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zoho_books_items')`
  );
  if (!tableExists?.exists) {
    console.log("Table zoho_books_items does not exist. Run: npm run db:init");
    process.exit(1);
  }

  const countResult = await queryOne<{ count: string }>("SELECT COUNT(*) AS count FROM zoho_books_items");
  const count = parseInt(countResult?.count ?? "0", 10);

  const latest = await queryOne<{ synced_at: string }>(
    "SELECT MAX(synced_at) AS synced_at FROM zoho_books_items"
  );

  console.log("--- Zoho Books items (DB cache) ---");
  console.log("Total rows:", count);
  console.log("Latest synced_at:", latest?.synced_at ?? "—");

  if (count > 0) {
    const sample = await query<{ id: string; name: string | null; sku: string | null; rate: unknown; synced_at: string }>(
      "SELECT id, name, sku, rate, synced_at FROM zoho_books_items ORDER BY synced_at DESC LIMIT 5"
    );
    console.log("\nSample (5 most recently synced):");
    sample.forEach((r, i) => {
      console.log(`  ${i + 1}. id=${r.id} name=${r.name ?? "—"} sku=${r.sku ?? "—"} rate=${r.rate ?? "—"} synced_at=${r.synced_at}`);
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
