/**
 * Wipes all users (and dependent data) then seeds two super admins.
 * Usage: npm run db:reset-users
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
  const sql = readFileSync(join(process.cwd(), "sql", "reset-users.sql"), "utf-8");

  await pool.query(sql);
  console.log("Users reset successfully. Two super admins seeded.");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
