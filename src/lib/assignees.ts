import { query, queryOne } from "@/lib/db";
import type { TeamName } from "@/types/db";

type Assignee = { id: string; name: string | null; email: string } | null;

export type TeamAssignees = {
  functionalHead: Assignee;
  l1Approver: Assignee;
  financeApprover: Assignee;
  cfo: Assignee;
  cdo: Assignee;
};

export async function getAssigneesForTeam(team: TeamName, selectedL1ManagerId?: string | null): Promise<TeamAssignees> {
  const [functionalHead, l1Approver, financeApprover, cfo, cdo] = await Promise.all([
    queryOne<{ id: string; name: string | null; email: string }>(
      "SELECT id, name, email FROM users WHERE roles @> ARRAY['FUNCTIONAL_HEAD']::\"UserRole\"[] AND team = $1 AND status = true LIMIT 1",
      [team]
    ),
    queryOne<{ id: string; name: string | null; email: string }>(
      `SELECT id, name, email FROM users
       WHERE roles @> ARRAY['L1_APPROVER']::"UserRole"[] AND team = $1 AND status = true
         AND ($2::uuid IS NULL OR id = $2)
       ORDER BY name NULLS LAST, email LIMIT 1`,
      [team, selectedL1ManagerId ?? null]
    ),
    queryOne<{ id: string; name: string | null; email: string }>(
      "SELECT id, name, email FROM users WHERE roles @> ARRAY['FINANCE_APPROVER']::\"UserRole\"[] AND status = true LIMIT 1"
    ),
    queryOne<{ id: string; name: string | null; email: string }>(
      "SELECT id, name, email FROM users WHERE roles @> ARRAY['CFO']::\"UserRole\"[] AND status = true LIMIT 1"
    ),
    queryOne<{ id: string; name: string | null; email: string }>(
      "SELECT id, name, email FROM users WHERE roles @> ARRAY['CDO']::\"UserRole\"[] AND status = true LIMIT 1"
    ),
  ]);
  return {
    functionalHead: functionalHead ?? null,
    l1Approver: l1Approver ?? null,
    financeApprover: financeApprover ?? null,
    cfo: cfo ?? null,
    cdo: cdo ?? null,
  };
}

/** Returns emails of active users holding the given role (e.g. all PRODUCTION or all FINANCE_APPROVER users). */
export async function getActiveUserEmailsByRole(role: "PRODUCTION" | "FINANCE_APPROVER"): Promise<string[]> {
  const rows = await query<{ email: string }>(
    `SELECT email FROM users WHERE roles @> ARRAY[$1::"UserRole"] AND status = true`,
    [role]
  );
  return rows.map((r) => r.email).filter(Boolean);
}

/** Returns emails of users with PRODUCTION role (for ASSIGNED_TO_PRODUCTION notifications). */
export async function getProductionEmails(): Promise<string[]> {
  return getActiveUserEmailsByRole("PRODUCTION");
}
