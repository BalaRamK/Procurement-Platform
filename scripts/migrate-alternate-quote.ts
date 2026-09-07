/**
 * Add alternate-quote loop-back tracking columns to tickets.
 * Usage: npm run db:migrate-alternate-quote
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
  const sql = readFileSync(join(process.cwd(), "sql", "migrate-alternate-quote.sql"), "utf-8");
  await pool.query(sql);
  console.log("Alternate-quote tracking columns added to tickets.");
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
