/**
 * Run ticket component-details migration.
 * Usage: npx tsx scripts/migrate-ticket-component-details.ts
 * Loads DATABASE_URL from .env / .env.local.
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
  const sqlPath = join(process.cwd(), "sql", "migrate-ticket-component-details.sql");
  const sql = readFileSync(sqlPath, "utf-8");

  await pool.query(sql);
  console.log("Ticket component details migration applied.");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
