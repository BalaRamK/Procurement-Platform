import { queryOne, query } from "@/lib/db";

const NOTIFICATION_TYPE_TO_TRIGGER: Record<string, string> = {
  on_creation: "request_created",
  assignment: "assigned_to_production",
  delivered: "delivered_to_requester",
  closure: "request_closed",
  team_assignment: "assigned_to_production",
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
    enabled: boolean;
  }>(
    `SELECT id, subject_template AS "subjectTemplate", body_template AS "bodyTemplate",
            trigger, timeline, enabled
     FROM email_templates
     WHERE trigger = $1 AND timeline = $2 AND enabled = true
     ORDER BY updated_at DESC LIMIT 1`,
    [trigger, timeline]
  );
  return template;
}

async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  if (!to || !to.includes("@")) return;
  if (process.env.RESEND_API_KEY) {
    // TODO: Integrate Resend when ready
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
    await sendEmail(recipient, subject, body);
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
