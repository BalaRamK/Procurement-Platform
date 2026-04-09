import { query } from "@/lib/db";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/email-template-catalog";

export async function ensureDefaultEmailTemplates() {
  const existing = await query<{ trigger: string; timeline: string }>(
    `SELECT trigger, timeline FROM email_templates`
  );
  const existingKeys = new Set(existing.map((row) => `${row.trigger}::${row.timeline}`));

  for (const template of DEFAULT_EMAIL_TEMPLATES) {
    const timeline = template.timeline ?? "immediate";
    const key = `${template.trigger}::${timeline}`;
    if (existingKeys.has(key)) continue;

    await query(
      `INSERT INTO email_templates (name, trigger, subject_template, body_template, timeline, delay_minutes, extra_recipients, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        template.name,
        template.trigger,
        template.subjectTemplate,
        template.bodyTemplate,
        timeline,
        timeline === "custom" ? template.delayMinutes ?? null : null,
        template.extraRecipients ?? null,
        template.enabled ?? true,
      ]
    );
  }
}
