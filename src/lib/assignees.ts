import { query, queryOne } from "@/lib/db";
import type { TeamName } from "@/types/db";

type Assignee = { name: string | null; email: string } | null;

export type TeamAssignees = {
  functionalHead: Assignee;
  l1Approver: Assignee;
  cfo: Assignee;
  cdo: Assignee;
};

export async function getAssigneesForTeam(team: TeamName): Promise<TeamAssignees> {
  const [functionalHead, l1Approver, cfo, cdo] = await Promise.all([
    queryOne<{ name: string | null; email: string }>(
      "SELECT name, email FROM users WHERE roles @> ARRAY['FUNCTIONAL_HEAD']::\"UserRole\"[] AND team = $1 AND status = true LIMIT 1",
      [team]
    ),
    queryOne<{ name: string | null; email: string }>(
      "SELECT name, email FROM users WHERE roles @> ARRAY['L1_APPROVER']::\"UserRole\"[] AND team = $1 AND status = true LIMIT 1",
      [team]
    ),
    queryOne<{ name: string | null; email: string }>(
      "SELECT name, email FROM users WHERE roles @> ARRAY['CFO']::\"UserRole\"[] AND status = true LIMIT 1"
    ),
    queryOne<{ name: string | null; email: string }>(
      "SELECT name, email FROM users WHERE roles @> ARRAY['CDO']::\"UserRole\"[] AND status = true LIMIT 1"
    ),
  ]);
  return {
    functionalHead: functionalHead ?? null,
    l1Approver: l1Approver ?? null,
    cfo: cfo ?? null,
    cdo: cdo ?? null,
  };
}

/** Returns emails of users with PRODUCTION role (for ASSIGNED_TO_PRODUCTION notifications). */
export async function getProductionEmails(): Promise<string[]> {
  const rows = await query<{ email: string }>(
    "SELECT email FROM users WHERE roles @> ARRAY['PRODUCTION']::\"UserRole\"[] AND status = true"
  );
  return rows.map((r) => r.email).filter(Boolean);
}
