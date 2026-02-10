import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import type { TeamName } from "@/types/db";

type Assignee = { name: string | null; email: string };

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const team = req.nextUrl.searchParams.get("team") as TeamName | null;
  if (!team || !["INNOVATION", "ENGINEERING", "SALES"].includes(team)) {
    return NextResponse.json({ error: "Invalid or missing team" }, { status: 400 });
  }

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

  const toAssignee = (u: { name: string | null; email: string } | null): Assignee | null =>
    u ? { name: u.name ?? null, email: u.email } : null;

  return NextResponse.json({
    functionalHead: toAssignee(functionalHead),
    l1Approver: toAssignee(l1Approver),
    cfo: toAssignee(cfo),
    cdo: toAssignee(cdo),
  });
}
