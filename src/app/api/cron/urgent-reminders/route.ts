import { NextRequest, NextResponse } from "next/server";
import { sendDueUrgentReminders } from "@/lib/urgent-reminders";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 401 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendDueUrgentReminders();
  console.log(
    `[cron/urgent-reminders] tickets=${result.ticketsProcessed} emails=${result.emailsQueued}`
  );
  return NextResponse.json({ ok: true, ...result });
}
