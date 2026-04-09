import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { logNotification } from "@/lib/notifications";

const AUTO_CLOSE_HOURS = 48;

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 401 });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== "Bearer " + secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - AUTO_CLOSE_HOURS * 60 * 60 * 1000);
  const tickets = await query<{ id: string; title: string; requesterEmail: string | null }>(
    `SELECT t.id, t.title, u.email AS "requesterEmail"
     FROM tickets t
     JOIN users u ON t.requester_id = u.id
     WHERE t.status = 'DELIVERED_TO_REQUESTER' AND t.delivered_at < $1`,
    [cutoff]
  );

  let closed = 0;
  for (const t of tickets) {
    await query("UPDATE tickets SET status = 'CLOSED', auto_closed_at = now(), updated_at = now() WHERE id = $1", [
      t.id,
    ]);
    if (t.requesterEmail) {
      await logNotification({
        ticketId: t.id,
        type: "closure",
        recipient: t.requesterEmail,
        payload: {
          title: t.title,
          autoClosed: true,
          currentStage: "Delivered to Requester",
          nextStage: "Closed",
        },
        emailTrigger: "request_auto_closed",
      });
    }
    closed++;
  }

  console.log(`[cron/auto-close] Closed ${closed} ticket(s)`);
  return NextResponse.json({ ok: true, closed });
}
