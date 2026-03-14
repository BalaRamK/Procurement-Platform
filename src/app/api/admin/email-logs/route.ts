import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.roles?.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const logs = await query<{
    id: string;
    ticketId: string;
    ticketTitle: string | null;
    type: string;
    recipient: string;
    sentAt: string;
    payload: string | null;
  }>(
    `SELECT n.id, n.ticket_id AS "ticketId", t.title AS "ticketTitle",
            n.type, n.recipient, n.sent_at AS "sentAt", n.payload
     FROM notifications n
     LEFT JOIN tickets t ON t.id = n.ticket_id
     ORDER BY n.sent_at DESC
     LIMIT 100`
  );

  const stats = await queryOne<{
    total: string;
    last24h: string;
    last7d: string;
  }>(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE sent_at >= NOW() - INTERVAL '24 hours') AS "last24h",
       COUNT(*) FILTER (WHERE sent_at >= NOW() - INTERVAL '7 days') AS "last7d"
     FROM notifications`
  );

  return NextResponse.json({ logs, stats });
}
