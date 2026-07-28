import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import type { TeamName } from "@/types/db";

type Assignee = { id: string; name: string | null; email: string };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const team = req.nextUrl.searchParams.get("team") as TeamName | null;
  if (!team || !["INNOVATION", "ENGINEERING", "SALES"].includes(team)) {
    return NextResponse.json({ error: "Invalid or missing team" }, { status: 400 });
  }

  const [functionalHead, l1Approvers, financeApprover, cfo, cdo] = await Promise.all([
    queryOne<Assignee>(
      "SELECT id, name, email FROM users WHERE roles @> ARRAY['FUNCTIONAL_HEAD']::\"UserRole\"[] AND team = $1 AND status = true LIMIT 1",
      [team]
    ),
    query<Assignee>(
      `SELECT id, name, email FROM users
       WHERE roles @> ARRAY['L1_APPROVER']::"UserRole"[] AND team = $1 AND status = true
       ORDER BY name NULLS LAST, email`,
      [team]
    ),
    queryOne<Assignee>(
      "SELECT id, name, email FROM users WHERE roles @> ARRAY['FINANCE_APPROVER']::\"UserRole\"[] AND status = true LIMIT 1"
    ),
    queryOne<Assignee>(
      "SELECT id, name, email FROM users WHERE roles @> ARRAY['CFO']::\"UserRole\"[] AND status = true LIMIT 1"
    ),
    queryOne<Assignee>(
      "SELECT id, name, email FROM users WHERE roles @> ARRAY['CDO']::\"UserRole\"[] AND status = true LIMIT 1"
    ),
  ]);

  const toAssignee = (u: Assignee | null): Assignee | null =>
    u ? { id: u.id, name: u.name ?? null, email: u.email } : null;

  return NextResponse.json({
    functionalHead: toAssignee(functionalHead),
    l1Approver: toAssignee(l1Approvers[0] ?? null),
    l1Approvers,
    financeApprover: toAssignee(financeApprover),
    cfo: toAssignee(cfo),
    cdo: toAssignee(cdo),
  });
}
