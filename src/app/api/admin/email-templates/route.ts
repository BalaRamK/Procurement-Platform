import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  trigger: z.string().min(1).max(100),
  subjectTemplate: z.string().min(1).max(500),
  bodyTemplate: z.string().min(1),
  timeline: z.enum(["immediate", "after_24h", "after_48h", "custom"]).default("immediate"),
  delayMinutes: z.number().int().min(0).optional().nullable(),
  enabled: z.boolean().default(true),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.roles?.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const templates = await query<Record<string, unknown>>(
    `SELECT id, name, trigger, subject_template AS "subjectTemplate", body_template AS "bodyTemplate",
            timeline, delay_minutes AS "delayMinutes", enabled, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM email_templates ORDER BY created_at DESC`
  );
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.roles?.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, trigger, subjectTemplate, bodyTemplate, timeline, delayMinutes, enabled } = parsed.data;
  const rows = await query<Record<string, unknown>>(
    `INSERT INTO email_templates (name, trigger, subject_template, body_template, timeline, delay_minutes, enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, trigger, subject_template AS "subjectTemplate", body_template AS "bodyTemplate",
               timeline, delay_minutes AS "delayMinutes", enabled, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [name, trigger, subjectTemplate, bodyTemplate, timeline, timeline === "custom" ? delayMinutes ?? null : null, enabled]
  );
  const template = rows[0];
  if (!template) return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  return NextResponse.json(template);
}
