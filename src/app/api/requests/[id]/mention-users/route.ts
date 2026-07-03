import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { canViewTicket } from "@/lib/tickets";
import type { TeamName, TicketStatus, UserRole } from "@/types/db";

/** Returns all active users for @ mention dropdown (anyone can be tagged in a comment). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: ticketId } = await params;
  const row = await queryOne<{ requesterId: string; status: TicketStatus; teamName: TeamName }>(
    `SELECT requester_id AS "requesterId", status, team_name AS "teamName" FROM tickets WHERE id = $1`,
    [ticketId]
  );
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canView = canViewTicket(
    session.user.roles as UserRole[],
    session.user.team as TeamName | null,
    row,
    session.user.id
  );
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await query<{ id: string; name: string | null; email: string }>(
    `SELECT id, name, email FROM users WHERE status = true ORDER BY name NULLS LAST, email`
  );
  return NextResponse.json(users);
}
