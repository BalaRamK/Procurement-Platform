/**
 * Add ORDER_PLACED to the TicketStatus enum.
 * Usage: npx tsx scripts/migrate-order-placed-status.ts
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";

config({ path: ".env" });
config({ path: ".env.local" });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Add it to .env or .env.local");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const sqlPath = join(process.cwd(), "sql", "migrate-order-placed-status.sql");
  const sql = readFileSync(sqlPath, "utf-8");

  await pool.query(sql);
  console.log("Order placed status migration applied.");
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
