/**
 * Initialize the database with the SQL schema.
 * Usage: npm run db:init (or npx tsx scripts/init-db.ts)
 * Requires DATABASE_URL in .env
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
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const schemaPath = join(process.cwd(), "sql", "schema.sql");
  const sql = readFileSync(schemaPath, "utf-8");

  await pool.query(sql);
  console.log("Schema applied successfully.");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
