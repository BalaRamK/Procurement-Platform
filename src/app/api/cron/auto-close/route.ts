import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logNotification } from "@/lib/notifications";

const AUTO_CLOSE_HOURS = 48;

/**
 * Auto-close tickets in DELIVERED_TO_REQUESTER for more than 48 hours
 * without confirmation. Call from a cron job (e.g. every hour).
 * FR 3.4: "The ticket to be auto closed after 48 hours if no confirmation from requester"
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== "Bearer " + process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - AUTO_CLOSE_HOURS * 60 * 60 * 1000);
  const tickets = await prisma.ticket.findMany({
    where: {
      status: "DELIVERED_TO_REQUESTER",
      deliveredAt: { lt: cutoff },
    },
    include: { requester: true },
  });

  let closed = 0;
  for (const t of tickets) {
    await prisma.ticket.update({
      where: { id: t.id },
      data: { status: "CLOSED", autoClosedAt: new Date() },
    });
    if (t.requester.email) {
      await logNotification({
        ticketId: t.id,
        type: "closure",
        recipient: t.requester.email,
        payload: { title: t.title, autoClosed: true },
      });
    }
    closed++;
  }

  return NextResponse.json({ ok: true, closed });
}
