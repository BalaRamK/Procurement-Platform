/**
 * Run Engineering L1, rejection attribution, and urgent reminder migration.
 * Usage: npm run db:migrate-engineering-l1
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
  const sql = readFileSync(
    join(process.cwd(), "sql", "migrate-engineering-l1-rejection-urgent.sql"),
    "utf-8"
  );
  await pool.query(sql);
  console.log("Engineering L1, rejection attribution, and urgent reminder migration applied.");
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
