import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await query<Record<string, unknown>>(
    `SELECT n.id, n.ticket_id AS "ticketId", n.type, n.recipient, n.sent_at AS "sentAt", n.payload,
            t.id AS "tId", t.title AS "tTitle", t.request_id AS "tRequestId", t.status AS "tStatus"
     FROM notifications n
     JOIN tickets t ON n.ticket_id = t.id
     WHERE n.recipient = $1
     ORDER BY n.sent_at DESC
     LIMIT 20`,
    [session.user.email]
  );

  const notifications = rows.map((r) => ({
    id: r.id,
    ticketId: r.ticketId,
    type: r.type,
    recipient: r.recipient,
    sentAt: r.sentAt,
    payload: r.payload,
    ticket: {
      id: r.tId,
      title: r.tTitle,
      requestId: r.tRequestId,
      status: r.tStatus,
    },
  }));

  return NextResponse.json(notifications);
}
