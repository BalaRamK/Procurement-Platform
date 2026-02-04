import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { TeamName } from "@/types/db";

type Assignee = { name: string | null; email: string };

/**
 * GET /api/flow-assignees?team=ENGINEERING
 * Returns name/email for each step in the approval flow for the given team.
 * Used by Map Flow to show who is in each role (FH, L1, CFO/CDO).
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const team = req.nextUrl.searchParams.get("team") as TeamName | null;
  if (!team || !["INNOVATION", "ENGINEERING", "SALES"].includes(team)) {
    return NextResponse.json({ error: "Invalid or missing team" }, { status: 400 });
  }

  const [functionalHead, l1Approver, cfo, cdo] = await Promise.all([
    prisma.user.findFirst({
      where: { role: "FUNCTIONAL_HEAD", team, status: true },
      select: { name: true, email: true },
    }),
    prisma.user.findFirst({
      where: { role: "L1_APPROVER", team, status: true },
      select: { name: true, email: true },
    }),
    prisma.user.findFirst({
      where: { role: "CFO", status: true },
      select: { name: true, email: true },
    }),
    prisma.user.findFirst({
      where: { role: "CDO", status: true },
      select: { name: true, email: true },
    }),
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
