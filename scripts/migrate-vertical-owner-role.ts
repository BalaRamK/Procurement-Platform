/**
 * Run Vertical Owner role migration.
 * Usage: npx tsx scripts/migrate-vertical-owner-role.ts
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
  const sql = readFileSync(join(process.cwd(), "sql", "migrate-vertical-owner-role.sql"), "utf-8");
  await pool.query(sql);
  console.log("Vertical Owner role migration applied.");
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
