import { query, queryOne } from "@/lib/db";

/**
 * Per-user permission for the Production Status dashboard (checkbox under User access).
 * Stored on the users row, so it applies to that access profile. Super Admins always have access.
 */
let columnEnsured = false;

/** Adds users.production_status_access if the database predates it. Safe to call repeatedly. */
export async function ensureProductionStatusAccessColumn() {
  if (columnEnsured) return;
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS production_status_access BOOLEAN NOT NULL DEFAULT false`);
  columnEnsured = true;
}

/** True for Super Admins and for users whose profile has the checkbox enabled. Never throws; defaults to false. */
export async function userHasProductionStatusAccess(
  userId: string | null | undefined,
  roles: readonly string[] | null | undefined
): Promise<boolean> {
  if (roles?.includes("SUPER_ADMIN")) return true;
  if (!userId) return false;
  try {
    await ensureProductionStatusAccessColumn();
    const row = await queryOne<{ productionStatusAccess: boolean | null }>(
      `SELECT production_status_access FROM users WHERE id = $1 AND status = true`,
      [userId]
    );
    return !!row?.productionStatusAccess;
  } catch (e) {
    console.error("[production-status access]", e);
    return false;
  }
}
