import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

/** Returns all active users for @ mention dropdown (anyone can be tagged in a comment). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: ticketId } = await params;
  const ticket = await query<{ requesterId: string }>(
    "SELECT requester_id AS \"requesterId\" FROM tickets WHERE id = $1",
    [ticketId]
  );
  const row = ticket[0];
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const roles = session.user.roles ?? [];
  const canView =
    roles.includes("SUPER_ADMIN") ||
    row.requesterId === session.user.id ||
    roles.includes("FUNCTIONAL_HEAD") ||
    roles.includes("L1_APPROVER") ||
    roles.includes("CFO") ||
    roles.includes("CDO") ||
    roles.includes("PRODUCTION");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await query<{ id: string; name: string | null; email: string }>(
    `SELECT id, name, email FROM users WHERE status = true ORDER BY name NULLS LAST, email`
  );
  return NextResponse.json(users);
}
