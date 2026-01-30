import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
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
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const templates = await prisma.emailTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
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
  const template = await prisma.emailTemplate.create({
    data: {
      name,
      trigger,
      subjectTemplate,
      bodyTemplate,
      timeline,
      delayMinutes: timeline === "custom" ? delayMinutes ?? null : null,
      enabled,
    },
  });
  return NextResponse.json(template);
}
