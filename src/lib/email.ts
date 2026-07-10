import { queryOne, query } from "@/lib/db";
import { SUBJECT_PREFIX } from "@/lib/email-template-catalog";
import { ensureDefaultEmailTemplates } from "@/lib/email-template-defaults";

type SmtpConfig = { host: string; port: string; from: string; user: string; pass: string; proxy: string };
export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  try {
    const rows = await query<{ key: string; value: string | null }>(
      `SELECT key, value FROM app_settings WHERE key = ANY($1)`,
      [["smtp_host", "smtp_port", "smtp_from", "smtp_user", "smtp_pass", "smtp_proxy"]]
    );
    const db: Record<string, string> = {};
    for (const row of rows) if (row.value) db[row.key] = row.value;

    const host = db["smtp_host"] || process.env.SENDGRID_SMTP_HOST || "";
    const port = db["smtp_port"] || process.env.SENDGRID_SMTP_PORT || "";
    const from = db["smtp_from"] || process.env.SENDGRID_MAIL || "";
    const user = db["smtp_user"] || process.env.SENDGRID_API_KEY_ID || process.env.SENDGRID_MAIL || "";
    const pass = db["smtp_pass"] || process.env.SENDGRID_API_KEY_SECRET || "";
    // Proxy: DB setting → SMTP_PROXY env → HTTP_PROXY / HTTPS_PROXY env
    const proxy = db["smtp_proxy"] || process.env.SMTP_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "";

    if (!host || !port || !from || !user || !pass) return null;
    return { host, port, from, user, pass, proxy };
  } catch {
    const host = process.env.SENDGRID_SMTP_HOST || "";
    const port = process.env.SENDGRID_SMTP_PORT || "";
    const from = process.env.SENDGRID_MAIL || "";
    const user = process.env.SENDGRID_API_KEY_ID || process.env.SENDGRID_MAIL || "";
    const pass = process.env.SENDGRID_API_KEY_SECRET || "";
    const proxy = process.env.SMTP_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || "";
    if (!host || !port || !from || !user || !pass) return null;
    return { host, port, from, user, pass, proxy };
  }
}

const NOTIFICATION_TYPE_TO_TRIGGER: Record<string, string> = {
  on_creation: "request_created",
  assignment: "request_submitted_to_l1",
  approval_update: "request_approval_update",
  order_placed: "production_marked_order_placed",
  delivered: "production_marked_delivered",
  closure: "requester_confirmed_receipt",
  team_assignment: "cdo_approved_moved_to_production",
  comment_mention: "comment_mention",
};

export type EmailContext = {
  requesterName?: string;
  requesterEmail?: string;
  ticketId?: string;       // human-readable request ID e.g. PR-0042
  ticketTitle?: string;
  status?: string;         // formatted e.g. "Pending Department Head Approval"
  currentStage?: string;
  nextStage?: string;
  rejectionRemarks?: string;
  department?: string;
  teamName?: string;
  priority?: string;       // formatted e.g. "High"
  needByDate?: string;
  estimatedCost?: string;
  description?: string;
  actionBy?: string;
  approverPosition?: string;
  approverName?: string;
  commentSnippet?: string;
  mentionedBy?: string;
  requestUrl?: string;
  [key: string]: string | undefined;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_FH_APPROVAL: "Pending Department Head Approval",
  PENDING_L1_APPROVAL: "Pending L1 Approval",
  PENDING_FINANCE_APPROVAL: "Pending Finance Approval",
  PENDING_CFO_APPROVAL: "Pending CFO Approval",
  PENDING_CDO_APPROVAL: "Pending CDO Approval",
  ASSIGNED_TO_PRODUCTION: "Assigned to Production",
  ORDER_PLACED: "Order Placed",
  DELIVERED_TO_REQUESTER: "Delivered to Requester",
  CONFIRMED_BY_REQUESTER: "Confirmed by Requester",
  CLOSED: "Closed",
  REJECTED: "Rejected",
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

function replacePlaceholders(text: string, context: EmailContext): string {
  let out = text;
  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined && value !== null) {
      out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, "gi"), String(value));
    }
  }
  return out.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, "Not applicable");
}

export async function sendPlatformEmail({
  to,
  subject,
  text,
  html,
  attachments,
}: {
  to: string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
}) {
  const finalTo = dedupeEmails(to);
  if (finalTo.length === 0) return { sent: false, reason: "No recipients" };

  const cfg = await getSmtpConfig();
  if (cfg) {
    const numPort = parseInt(cfg.port, 10) || 587;
    const nodemailer = await import("nodemailer");
    const transportOptions: Record<string, unknown> = {
      host: cfg.host,
      port: numPort,
      secure: numPort === 465,
      auth: { user: cfg.user, pass: cfg.pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    };
    if (cfg.proxy) transportOptions.proxy = cfg.proxy;
    const transporter = nodemailer.default.createTransport(transportOptions);
    await transporter.sendMail({
      from: cfg.from,
      to: finalTo.join(", "),
      subject,
      text,
      html: html ?? text.replace(/\n/g, "<br>"),
      attachments,
    });
    return { sent: true, recipients: finalTo };
  }

  console.log("[Email stub]", {
    to: finalTo,
    subject,
    bodyLength: text.length,
    attachments: attachments?.map((attachment) => attachment.filename) ?? [],
  });
  return { sent: false, reason: "SMTP not configured", recipients: finalTo };
}

export async function getTemplateForTrigger(
  trigger: string,
  timeline: "immediate" | "after_24h" | "after_48h" = "immediate"
) {
  await ensureDefaultEmailTemplates();
  const template = await queryOne<{
    id: string;
    subjectTemplate: string;
    bodyTemplate: string;
    trigger: string;
    timeline: string;
    extraRecipients: string | null;
    enabled: boolean;
  }>(
    `SELECT id, subject_template AS "subjectTemplate", body_template AS "bodyTemplate",
            trigger, timeline, extra_recipients AS "extraRecipients", enabled
     FROM email_templates
     WHERE trigger = $1 AND timeline = $2 AND enabled = true
     ORDER BY updated_at DESC LIMIT 1`,
    [trigger, timeline]
  );
  return template;
}

async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  if (!to || !to.includes("@")) return;

  const cfg = await getSmtpConfig();
  if (cfg) {
    try {
      const numPort = parseInt(cfg.port, 10) || 587;
      const nodemailer = await import("nodemailer");
      const transportOptions: Record<string, unknown> = {
        host: cfg.host,
        port: numPort,
        secure: numPort === 465,
        auth: { user: cfg.user, pass: cfg.pass },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      };
      if (cfg.proxy) transportOptions.proxy = cfg.proxy;
      const transporter = nodemailer.default.createTransport(transportOptions);
      await transporter.sendMail({
        from: cfg.from,
        to,
        subject,
        text: body,
        html: body.replace(/\n/g, "<br>"),
      });
      return;
    } catch (e) {
      console.error("[sendEmail] SMTP failed", e);
    }
  }

  console.log("[Email stub]", { to: to.slice(0, 3) + "…", subject, bodyLength: body.length });
}

function dedupeEmails(emails: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const email of emails) {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes("@") || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function prefixSubject(subject: string) {
  return subject.startsWith(SUBJECT_PREFIX) ? subject : `${SUBJECT_PREFIX}${subject}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderWorkflowEmailHtml(subject: string, body: string) {
  const lines = body.split(/\r?\n/).map((line) => line.trim());
  const detailStart = lines.findIndex((line) => line.toLowerCase() === "request details:");
  const openRequestLine = lines.find((line) => line.startsWith("Open request:"));
  const requestUrl = openRequestLine?.replace("Open request:", "").trim() ?? "";
  const introLines = (detailStart >= 0 ? lines.slice(0, detailStart) : lines)
    .filter((line) => line && !line.startsWith("Open request:"));
  const detailLines = detailStart >= 0 ? lines.slice(detailStart + 1) : [];
  const details = detailLines
    .filter((line) => line.includes(":") && !line.startsWith("Open request:"))
    .map((line) => {
      const separator = line.indexOf(":");
      return {
        label: line.slice(0, separator).trim(),
        value: line.slice(separator + 1).trim() || "Not applicable",
      };
    });
  const status = details.find((detail) => detail.label === "Next stage")?.value
    ?? details.find((detail) => detail.label === "Current stage")?.value
    ?? "Procurement update";
  const visibleDetails = details.filter((detail) => detail.label !== "Open request");

  const detailRows = visibleDetails.map((detail) => `
    <tr>
      <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;width:36%;">${escapeHtml(detail.label)}</td>
      <td style="padding:12px 14px;border-bottom:1px solid #e5e7eb;color:#0f172a;font-size:14px;font-weight:600;">${escapeHtml(detail.value)}</td>
    </tr>`).join("");

  const paragraphs = introLines.map((line, index) => {
    const color = index === 0 ? "#334155" : "#475569";
    return `<p style="margin:0 0 14px;color:${color};font-size:15px;line-height:1.6;">${escapeHtml(line)}</p>`;
  }).join("");

  const cta = requestUrl
    ? `<a href="${escapeHtml(requestUrl)}" style="display:inline-block;margin-top:18px;padding:12px 18px;border-radius:8px;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">Open request</a>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;background:#0f172a;">
                <div style="color:#93c5fd;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Procurement Platform</div>
                <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;line-height:1.3;">${escapeHtml(subject.replace(SUBJECT_PREFIX, ""))}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 8px;">
                <span style="display:inline-block;padding:7px 10px;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:700;">${escapeHtml(status)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 18px;">
                ${paragraphs}
                ${cta}
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;border-collapse:separate;border-spacing:0;">
                  ${detailRows}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.5;">
                Please do not reply to this email. This is an autogenerated email from Procurement Platform. Please use the request page for comments and audit history.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendWorkflowEmail(to: string[], subject: string, body: string): Promise<void> {
  const finalTo = dedupeEmails(to);
  if (finalTo.length === 0) return;

  try {
    await sendPlatformEmail({
      to: finalTo,
      subject: prefixSubject(subject),
      text: body,
      html: renderWorkflowEmailHtml(prefixSubject(subject), body),
    });
    return;
  } catch (e) {
    console.error("[sendWorkflowEmail] SMTP failed", e);
  }

  console.log("[Email stub]", {
    to: finalTo,
    subject: prefixSubject(subject),
    bodyLength: body.length,
  });
}

export async function sendNotificationEmail(
  trigger: string,
  recipient: string,
  ticketId: string,
  extraContext?: EmailContext
): Promise<void> {
  if (!recipient?.includes("@")) return;
  try {
    const ticket = await queryOne<{
      requestId: string | null;
      title: string;
      status: string;
      rejectionRemarks: string | null;
      requesterName: string | null;
      requesterEmail: string | null;
      department: string;
      teamName: string;
      priority: string;
      needByDate: string | null;
      estimatedCost: string | null;
      costCurrency: string | null;
      description: string | null;
      userName: string | null;
    }>(
      `SELECT t.request_id AS "requestId", t.title, t.status,
              t.rejection_remarks AS "rejectionRemarks",
              t.requester_name AS "requesterName",
              u.email AS "requesterEmail",
              t.department, t.team_name AS "teamName",
              t.priority, t.need_by_date AS "needByDate",
              t.estimated_cost AS "estimatedCost",
              t.cost_currency AS "costCurrency",
              t.description,
              u.name AS "userName"
       FROM tickets t
       LEFT JOIN users u ON u.id = t.requester_id
       WHERE t.id = $1`,
      [ticketId]
    );

    const readableId = ticket?.requestId ?? ticketId;
    const requestUrlBase = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
    const cost = ticket?.estimatedCost
      ? `${ticket.costCurrency ?? ""} ${ticket.estimatedCost}`.trim()
      : "";
    const needByDate = ticket?.needByDate
      ? new Date(ticket.needByDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : "";

    const context: EmailContext = {
      requesterName: ticket?.userName ?? ticket?.requesterName ?? "",
      requesterEmail: ticket?.requesterEmail ?? "",
      ticketId: readableId,
      ticketTitle: ticket?.title ?? "",
      status: STATUS_LABELS[ticket?.status ?? ""] ?? ticket?.status ?? "",
      currentStage: STATUS_LABELS[ticket?.status ?? ""] ?? ticket?.status ?? "",
      nextStage: "",
      rejectionRemarks: ticket?.rejectionRemarks ?? extraContext?.rejectionRemarks ?? "",
      department: ticket?.department ?? "",
      teamName: ticket?.teamName ?? "",
      priority: PRIORITY_LABELS[ticket?.priority ?? ""] ?? ticket?.priority ?? "",
      needByDate,
      estimatedCost: cost,
      description: ticket?.description ?? "",
      requestUrl: requestUrlBase ? `${requestUrlBase}/requests/${ticketId}` : "",
      actionBy: "System",
      approverPosition: "Not applicable",
      approverName: "Not applicable",
      ...extraContext,
    };
    const template = await getTemplateForTrigger(trigger, "immediate");
    if (!template) return;
    const subject = replacePlaceholders(template.subjectTemplate, context);
    const body = replacePlaceholders(template.bodyTemplate, context);

    await sendWorkflowEmail([recipient], subject, body);
  } catch (e) {
    console.error("[sendNotificationEmail]", trigger, recipient, e);
  }
}

export async function sendNotificationEmailByType(
  type: string,
  recipient: string,
  ticketId: string,
  payload?: Record<string, unknown>
): Promise<void> {
  const trigger = NOTIFICATION_TYPE_TO_TRIGGER[type];
  if (!trigger) return;
  const extra: EmailContext = {};
  if (payload?.title) extra.ticketTitle = String(payload.title);
  if (payload?.rejectionRemarks) extra.rejectionRemarks = String(payload.rejectionRemarks);
  for (const [key, value] of Object.entries(payload ?? {})) {
    if (typeof value === "string") extra[key] = value;
    if (typeof value === "number" || typeof value === "boolean") extra[key] = String(value);
  }
  await sendNotificationEmail(trigger, recipient, ticketId, extra);
}
