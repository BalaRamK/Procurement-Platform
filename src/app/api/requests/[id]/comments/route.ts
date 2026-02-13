import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { logNotification } from "@/lib/notifications";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: ticketId } = await params;
  const ticket = await queryOne<{ requesterId: string }>(
    "SELECT requester_id AS \"requesterId\" FROM tickets WHERE id = $1",
    [ticketId]
  );
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isRequester = ticket.requesterId === session.user.id;
  const roles = session.user.roles ?? [];
  const canView =
    roles.includes("SUPER_ADMIN") ||
    isRequester ||
    roles.includes("FUNCTIONAL_HEAD") ||
    roles.includes("L1_APPROVER") ||
    roles.includes("CFO") ||
    roles.includes("CDO") ||
    roles.includes("PRODUCTION");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const comments = await query<Record<string, unknown>>(
    `SELECT c.id, c.ticket_id AS "ticketId", c.user_id AS "userId", c.body, c.created_at AS "createdAt",
            u.email AS "uEmail", u.name AS "uName"
     FROM comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.ticket_id = $1
     ORDER BY c.created_at ASC`,
    [ticketId]
  );

  const mapped = comments.map((c) => ({
    id: c.id,
    ticketId: c.ticketId,
    userId: c.userId,
    body: c.body,
    createdAt: c.createdAt,
    user: { email: c.uEmail, name: c.uName },
  }));

  return NextResponse.json(mapped);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: ticketId } = await params;
  const ticket = await queryOne<{ requesterId: string; title: string }>(
    "SELECT requester_id AS \"requesterId\", title FROM tickets WHERE id = $1",
    [ticketId]
  );
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isRequester = ticket.requesterId === session.user.id;
  const roles = session.user.roles ?? [];
  const canComment =
    roles.includes("SUPER_ADMIN") ||
    isRequester ||
    roles.includes("FUNCTIONAL_HEAD") ||
    roles.includes("L1_APPROVER") ||
    roles.includes("CFO") ||
    roles.includes("CDO") ||
    roles.includes("PRODUCTION");
  if (!canComment) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as { body: string };
  if (!body.body?.trim()) {
    return NextResponse.json({ error: "Comment body required" }, { status: 400 });
  }

  const trimmedBody = body.body.trim();
  const rows = await query<Record<string, unknown>>(
    `INSERT INTO comments (ticket_id, user_id, body) VALUES ($1, $2, $3)
     RETURNING id, ticket_id AS "ticketId", user_id AS "userId", body, created_at AS "createdAt"`,
    [ticketId, session.user.id, trimmedBody]
  );
  const comment = rows[0];
  if (!comment) return NextResponse.json({ error: "Insert failed" }, { status: 500 });

  const user = await queryOne<{ email: string; name: string | null }>(
    "SELECT email, name FROM users WHERE id = $1",
    [session.user.id]
  );
  const out = { ...comment, user: user ? { email: user.email, name: user.name } : null };

  const mentionIds = [...trimmedBody.matchAll(/@\[[^\]]*\]\(([a-f0-9-]{36})\)/gi)].map((m) => m[1]);
  const uniqueIds = [...new Set(mentionIds)];
  for (const userId of uniqueIds) {
    if (userId === session.user.id) continue;
    const mentioned = await queryOne<{ email: string }>("SELECT email FROM users WHERE id = $1 AND status = true", [userId]);
    if (mentioned?.email) {
      await logNotification({
        ticketId,
        type: "comment_mention",
        recipient: mentioned.email,
        payload: { title: ticket.title ?? "", commentSnippet: trimmedBody.slice(0, 100) },
      });
    }
  }

  return NextResponse.json(out);
}
