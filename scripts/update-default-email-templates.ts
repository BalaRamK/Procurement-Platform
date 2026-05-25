/**
 * Updates the database email template rows to match the current default catalog.
 * Usage: npx tsx scripts/update-default-email-templates.ts
 */
import { config } from "dotenv";
import { Pool } from "pg";
import { DEFAULT_EMAIL_TEMPLATES } from "../src/lib/email-template-catalog";

config({ path: ".env" });
config({ path: ".env.local" });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Add it to .env or .env.local");
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  for (const template of DEFAULT_EMAIL_TEMPLATES) {
    const timeline = template.timeline ?? "immediate";
    const updated = await pool.query(
      `UPDATE email_templates
       SET name = $1,
           subject_template = $2,
           body_template = $3,
           delay_minutes = $4,
           extra_recipients = NULL,
           enabled = $5,
           updated_at = now()
       WHERE trigger = $6 AND timeline = $7`,
      [
        template.name,
        template.subjectTemplate,
        template.bodyTemplate,
        timeline === "custom" ? template.delayMinutes ?? null : null,
        template.enabled ?? true,
        template.trigger,
        timeline,
      ]
    );

    if (updated.rowCount === 0) {
      await pool.query(
        `INSERT INTO email_templates (name, trigger, subject_template, body_template, timeline, delay_minutes, extra_recipients, enabled)
         VALUES ($1, $2, $3, $4, $5, $6, NULL, $7)`,
        [
          template.name,
          template.trigger,
          template.subjectTemplate,
          template.bodyTemplate,
          timeline,
          timeline === "custom" ? template.delayMinutes ?? null : null,
          template.enabled ?? true,
        ]
      );
    }
  }

  await pool.end();
  console.log("Default email templates updated. Workflow emails remain To-only; extra_recipients were cleared.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
