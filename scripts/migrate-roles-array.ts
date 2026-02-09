/**
 * Run the roles-array migration (user.role → user.roles).
 * Usage: npm run db:migrate-roles (or npx tsx scripts/migrate-roles-array.ts)
 * Loads .env automatically so DATABASE_URL is set.
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
    console.error("DATABASE_URL is not set. Set it in .env or run from the app directory.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const sqlPath = join(process.cwd(), "sql", "migrate-roles-array.sql");
  const sql = readFileSync(sqlPath, "utf-8");

  await pool.query(sql);
  console.log("Roles migration applied successfully.");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
