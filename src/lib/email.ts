import { prisma } from "@/lib/prisma";

/**
 * Map internal notification types to email template triggers (Admin configurable).
 */
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

/**
 * Find an enabled email template for the given trigger and timeline.
 * Only "immediate" is used for sending now; after_24h/after_48h can be used by a cron later.
 */
export async function getTemplateForTrigger(
  trigger: string,
  timeline: "immediate" | "after_24h" | "after_48h" = "immediate"
) {
  const template = await prisma.emailTemplate.findFirst({
    where: { trigger, timeline, enabled: true },
    orderBy: { updatedAt: "desc" },
  });
  return template;
}

/**
 * Stub: send email. Log to console when no provider is configured.
 * Set SMTP_* or RESEND_API_KEY (etc.) and implement real send here when ready.
 */
async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  if (!to || !to.includes("@")) return;
  // TODO: Integrate Resend, SendGrid, Nodemailer, etc. when env is set
  if (process.env.RESEND_API_KEY) {
    // Example: await Resend.emails.send({ from: "...", to, subject, html: body });
  }
  // Log for now so admins can verify templates are triggered
  console.log("[Email stub]", { to: to.slice(0, 3) + "…", subject, bodyLength: body.length });
}

/**
 * Load ticket data for placeholders, find template by trigger, replace placeholders, send.
 * Called after logNotification or on rejection. Only sends for "immediate" timeline.
 */
export async function sendNotificationEmail(
  trigger: string,
  recipient: string,
  ticketId: string,
  extraContext?: EmailContext
): Promise<void> {
  if (!recipient?.includes("@")) return;
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { requester: true },
    });
    const context: EmailContext = {
      requesterName: ticket?.requester?.name ?? ticket?.requesterName ?? "",
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

/**
 * Map notification type to trigger and send if template exists.
 */
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
