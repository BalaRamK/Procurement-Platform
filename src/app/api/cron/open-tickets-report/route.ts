import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { sendPlatformEmail } from "@/lib/email";
import {
  OPEN_TICKET_REPORT_SQL,
  toOpenTicketReportRows,
  toOpenTicketReportSheet,
  type OpenTicketReportSource,
} from "@/lib/open-ticket-report";

export const runtime = "nodejs";

function buildReportHtml(rowCount: number) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;background:#0f172a;">
                <div style="color:#93c5fd;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Procurement Platform</div>
                <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;line-height:1.3;">Weekly Open Tickets Report</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px;color:#334155;font-size:15px;line-height:1.6;">
                <p style="margin:0 0 14px;">Please find attached the current open tickets report from the Procurement Platform.</p>
                <p style="margin:0 0 14px;">The report includes request ID, requestor, team, created date, ticket title, item, and the current pending owner.</p>
                <p style="margin:0;">Open ticket count: <strong>${rowCount}</strong></p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.5;">
                This is an automated weekly email from Procurement Platform.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function buildWorkbookBuffer(rows: ReturnType<typeof toOpenTicketReportRows>) {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.aoa_to_sheet(toOpenTicketReportSheet(rows));
  worksheet["!cols"] = [
    { wch: 8 },
    { wch: 16 },
    { wch: 24 },
    { wch: 16 },
    { wch: 16 },
    { wch: 36 },
    { wch: 52 },
    { wch: 28 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Open Tickets");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 401 });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== "Bearer " + secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admins = await query<{ email: string }>(
    `SELECT DISTINCT LOWER(email) AS email
     FROM users
     WHERE roles @> ARRAY['SUPER_ADMIN']::"UserRole"[]
       AND status = true
       AND email IS NOT NULL
     ORDER BY email`
  );
  const recipients = admins.map((admin) => admin.email).filter(Boolean);
  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, sent: false, reason: "No active admin recipients" });
  }

  const sourceRows = await query<OpenTicketReportSource>(OPEN_TICKET_REPORT_SQL);
  const reportRows = toOpenTicketReportRows(sourceRows);
  const workbook = await buildWorkbookBuffer(reportRows);
  const reportDate = new Date().toISOString().slice(0, 10);
  const subject = `Procurement Platform - Weekly Open Tickets Report - ${reportDate}`;
  const text = [
    "Please find attached the current open tickets report from the Procurement Platform.",
    "",
    "The report includes request ID, requestor, team, created date, ticket title, item, and pending owner.",
    `Open ticket count: ${reportRows.length}`,
  ].join("\n");

  const result = await sendPlatformEmail({
    to: recipients,
    subject,
    text,
    html: buildReportHtml(reportRows.length),
    attachments: [
      {
        filename: `open-tickets-report-${reportDate}.xlsx`,
        content: workbook,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ],
  });

  console.log(`[cron/open-tickets-report] recipients=${recipients.length} rows=${reportRows.length}`);
  return NextResponse.json({ ok: true, ...result, rows: reportRows.length, recipients: recipients.length });
}
