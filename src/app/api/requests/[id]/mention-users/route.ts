import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import type { TeamName } from "@/types/db";

/** Returns users who can view/comment on this ticket (for @ mention dropdown). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: ticketId } = await params;
  const ticket = await query<{ requesterId: string; teamName: string }>(
    "SELECT requester_id AS \"requesterId\", team_name AS \"teamName\" FROM tickets WHERE id = $1",
    [ticketId]
  );
  const row = ticket[0];
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const team = row.teamName as TeamName;
  const requesterId = row.requesterId;

  const roles = session.user.roles ?? [];
  const canView =
    roles.includes("SUPER_ADMIN") ||
    requesterId === session.user.id ||
    roles.includes("FUNCTIONAL_HEAD") ||
    roles.includes("L1_APPROVER") ||
    roles.includes("CFO") ||
    roles.includes("CDO") ||
    roles.includes("PRODUCTION");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = `
    SELECT DISTINCT u.id, u.name, u.email
    FROM users u
    WHERE u.status = true
      AND (
        u.id = $1
        OR u.roles @> ARRAY['SUPER_ADMIN']::"UserRole"[]
        OR u.roles @> ARRAY['CFO']::"UserRole"[]
        OR u.roles @> ARRAY['CDO']::"UserRole"[]
        OR u.roles @> ARRAY['PRODUCTION']::"UserRole"[]
        OR (u.roles @> ARRAY['FUNCTIONAL_HEAD']::"UserRole"[] AND u.team = $2)
        OR (u.roles @> ARRAY['L1_APPROVER']::"UserRole"[] AND u.team = $2)
        OR (u.roles @> ARRAY['REQUESTER']::"UserRole"[] AND u.id = $1)
      )
    ORDER BY u.name NULLS LAST, u.email
  `;
  const users = await query<{ id: string; name: string | null; email: string }>(q, [
    requesterId,
    team,
  ]);
  return NextResponse.json(users);
}
