/**
 * One-off script: grant SUPER_ADMIN role to a user by email.
 * Usage: npx tsx scripts/grant-super-admin.ts your@email.com
 * Requires DATABASE_URL in .env
 */
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });
import { query, queryOne } from "../src/lib/db";

const EMAIL = process.argv[2] ?? "bala.k@qnulabs.com";

async function main() {
  const existing = await queryOne<{ id: string; roles: string[] }>("SELECT id, roles FROM users WHERE email = $1", [EMAIL]);
  if (existing) {
    if ((existing.roles ?? []).includes("SUPER_ADMIN")) {
      console.log("User already has SUPER_ADMIN:", EMAIL);
      return;
    }
    await query(
      `UPDATE users SET roles = array_append(COALESCE(roles, ARRAY['REQUESTER']::"UserRole"[]), 'SUPER_ADMIN'::"UserRole"), updated_at = now() WHERE id = $1`,
      [existing.id]
    );
    console.log("Granted SUPER_ADMIN to:", EMAIL);
  } else {
    await query(
      `INSERT INTO users (email, name, roles, status) VALUES ($1, $2, ARRAY['SUPER_ADMIN']::"UserRole"[], true)`,
      [EMAIL, EMAIL.split("@")[0]]
    );
    console.log("Created user with SUPER_ADMIN:", EMAIL);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
