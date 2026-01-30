import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { UserRole, TeamName } from "@prisma/client";
import { z } from "zod";

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  role: z.nativeEnum(UserRole),
  team: z.nativeEnum(TeamName).nullable().optional(),
});

const patchSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  team: z.nativeEnum(TeamName).nullable().optional(),
  status: z.boolean().optional(),
});

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

  const { email, name, role, team } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { name: name ?? existing.name, role, team: team ?? existing.team, status: true },
    });
    return NextResponse.json({ ok: true, user: existing, updated: true });
  }

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: name ?? undefined,
      role,
      team: team ?? undefined,
      status: true,
    },
  });
  return NextResponse.json({ ok: true, user });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { userId, email, name, role, team, status } = parsed.data;
  const update: {
    email?: string;
    name?: string | null;
    role?: UserRole;
    team?: TeamName | null;
    status?: boolean;
  } = {};
  if (email !== undefined) {
    const normalized = email.trim().toLowerCase();
    const taken = await prisma.user.findFirst({
      where: { email: normalized, id: { not: userId } },
    });
    if (taken) {
      return NextResponse.json({ error: "Email already in use" }, { status: 400 });
    }
    update.email = normalized;
  }
  if (name !== undefined) update.name = name || null;
  if (role !== undefined) update.role = role;
  if (team !== undefined) update.team = team;
  if (status !== undefined) update.status = status;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: update,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  if (session.user.id === userId) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { status: false },
  });

  return NextResponse.json({ ok: true });
}
