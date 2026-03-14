import { queryOne, query } from "@/lib/db";

type SmtpConfig = { host: string; port: string; from: string; user: string; pass: string; proxy: string };

async function getSmtpConfig(): Promise<SmtpConfig | null> {
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
  assignment: "assigned_to_production",
  delivered: "delivered_to_requester",
  closure: "request_closed",
  team_assignment: "assigned_to_production",
  comment_mention: "comment_mention",
};

export type EmailContext = {
  requesterName?: string;
  ticketId?: string;
  ticketTitle?: string;
  status?: string;
  rejectionRemarks?: string;
  [key: string]: string | undefined;
};

function replacePlaceholders(text: string, context: EmailContext): string {
  let out = text;
  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined && value !== null) {
      out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, "gi"), String(value));
    }
  }
  return out;
}

export async function getTemplateForTrigger(
  trigger: string,
  timeline: "immediate" | "after_24h" | "after_48h" = "immediate"
) {
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

export async function sendNotificationEmail(
  trigger: string,
  recipient: string,
  ticketId: string,
  extraContext?: EmailContext
): Promise<void> {
  if (!recipient?.includes("@")) return;
  try {
    const ticket = await queryOne<{
      id: string;
      title: string;
      status: string;
      rejectionRemarks: string | null;
      requesterName: string | null;
    }>(
      `SELECT t.id, t.title, t.status, t.rejection_remarks AS "rejectionRemarks",
              t.requester_name AS "requesterName"
       FROM tickets t
       WHERE t.id = $1`,
      [ticketId]
    );
    const requesterName = await queryOne<{ name: string | null }>(
      "SELECT name FROM users u JOIN tickets t ON t.requester_id = u.id WHERE t.id = $1",
      [ticketId]
    );
    const context: EmailContext = {
      requesterName: requesterName?.name ?? ticket?.requesterName ?? "",
      ticketId: ticket?.id ?? ticketId,
      ticketTitle: ticket?.title ?? "",
      status: ticket?.status ?? "",
      rejectionRemarks: ticket?.rejectionRemarks ?? extraContext?.rejectionRemarks ?? "",
      ...extraContext,
    };
    const template = await getTemplateForTrigger(trigger, "immediate");
    if (!template) return;
    const subject = replacePlaceholders(template.subjectTemplate, context);
    const body = replacePlaceholders(template.bodyTemplate, context);

    // Build full recipient list: primary + any extra recipients defined on the template
    const extras = (template.extraRecipients ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));
    const allRecipients = [recipient, ...extras].filter(Boolean);
    await sendEmail(allRecipients.join(", "), subject, body);
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
  await sendNotificationEmail(trigger, recipient, ticketId, extra);
}
