/**
 * Re-send notification emails that were logged in `notifications` but never delivered (e.g. SMTP outage).
 * Dry run by default; nothing is sent without --send. Does not create new notification rows.
 *
 * Usage:
 *   npx tsx scripts/resend-notifications.ts --from 2026-10-30T04:50:00Z --to 2026-10-30T05:10:00Z
 *   npx tsx scripts/resend-notifications.ts --from ... --to ... --send
 *
 * Note: emails are rebuilt from the ticket's current state, so status/stage text reflects now, not then.
 * sendNotificationEmailByType swallows send errors and logs them; watch the output for "SMTP failed".
 */
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });
import { query } from "../src/lib/db";
import { sendNotificationEmailByType } from "../src/lib/email";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const from = arg("from");
  const to = arg("to");
  const send = process.argv.includes("--send");
  if (!from || !to || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    console.error("Usage: --from <ISO time> --to <ISO time> [--send]");
    process.exit(1);
  }
  if (process.env.GRAPH_MAIL_SENDER) {
    console.error("GRAPH_MAIL_SENDER is set in this shell, so mail would go through Graph. Run: unset GRAPH_MAIL_SENDER");
    process.exit(1);
  }

  const rows = await query<{
    id: string;
    ticket_id: string;
    request_id: string | null;
    type: string;
    recipient: string;
    sent_at: Date;
    payload: string | null;
  }>(
    `SELECT n.id, n.ticket_id, t.request_id, n.type, n.recipient, n.sent_at, n.payload
     FROM notifications n JOIN tickets t ON t.id = n.ticket_id
     WHERE n.sent_at >= $1 AND n.sent_at <= $2 AND n.recipient LIKE '%@%'
     ORDER BY n.sent_at`,
    [from, to]
  );

  console.log(`${send ? "SENDING" : "DRY RUN"}: ${rows.length} notification(s) between ${from} and ${to}`);
  for (const r of rows) {
    console.log(`- ${r.sent_at.toISOString()} ${r.request_id ?? r.ticket_id} ${r.type} -> ${r.recipient}`);
    if (!send) continue;
    let payload: Record<string, unknown> | undefined;
    try {
      payload = r.payload ? JSON.parse(r.payload) : undefined;
    } catch {
      payload = undefined;
    }
    await sendNotificationEmailByType(r.type, r.recipient, r.ticket_id, payload);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!send) console.log("Nothing sent. Add --send to send these.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
