import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  trigger: z.string().min(1).max(100).optional(),
  subjectTemplate: z.string().min(1).max(500).optional(),
  bodyTemplate: z.string().min(1).optional(),
  timeline: z.enum(["immediate", "after_24h", "after_48h", "custom"]).optional(),
  delayMinutes: z.number().int().min(0).nullable().optional(),
  enabled: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const template = await queryOne<Record<string, unknown>>(
    `SELECT id, name, trigger, subject_template AS "subjectTemplate", body_template AS "bodyTemplate",
            timeline, delay_minutes AS "delayMinutes", enabled, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM email_templates WHERE id = $1`,
    [id]
  );
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(template);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = { ...parsed.data };
  if (data.timeline !== undefined && data.timeline !== "custom") data.delayMinutes = null;

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (data.name !== undefined) {
    setClauses.push(`name = $${i++}`);
    values.push(data.name);
  }
  if (data.trigger !== undefined) {
    setClauses.push(`trigger = $${i++}`);
    values.push(data.trigger);
  }
  if (data.subjectTemplate !== undefined) {
    setClauses.push(`subject_template = $${i++}`);
    values.push(data.subjectTemplate);
  }
  if (data.bodyTemplate !== undefined) {
    setClauses.push(`body_template = $${i++}`);
    values.push(data.bodyTemplate);
  }
  if (data.timeline !== undefined) {
    setClauses.push(`timeline = $${i++}`);
    values.push(data.timeline);
  }
  if (data.delayMinutes !== undefined) {
    setClauses.push(`delay_minutes = $${i++}`);
    values.push(data.delayMinutes);
  }
  if (data.enabled !== undefined) {
    setClauses.push(`enabled = $${i++}`);
    values.push(data.enabled);
  }

  if (setClauses.length === 0) {
    const template = await queryOne<Record<string, unknown>>(
      `SELECT id, name, trigger, subject_template AS "subjectTemplate", body_template AS "bodyTemplate",
              timeline, delay_minutes AS "delayMinutes", enabled, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM email_templates WHERE id = $1`,
      [id]
    );
    return NextResponse.json(template);
  }

  setClauses.push("updated_at = now()");
  values.push(id);
  const rows = await query<Record<string, unknown>>(
    `UPDATE email_templates SET ${setClauses.join(", ")} WHERE id = $${i} RETURNING id, name, trigger, subject_template AS "subjectTemplate", body_template AS "bodyTemplate", timeline, delay_minutes AS "delayMinutes", enabled, created_at AS "createdAt", updated_at AS "updatedAt"`,
    values
  );
  return NextResponse.json(rows[0]);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await query("DELETE FROM email_templates WHERE id = $1", [id]);
  return NextResponse.json({ ok: true });
}
