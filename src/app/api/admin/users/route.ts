import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import type { UserRole, TeamName } from "@/types/db";
import { USER_ROLES, TEAM_NAMES } from "@/types/db";
import { z } from "zod";

const createSchema = z.object({
  email: z.string().email(),
  profileName: z.string().min(1).max(100).optional(),
  name: z.string().optional(),
  roles: z.array(z.enum(USER_ROLES)).min(1),
  team: z.enum(TEAM_NAMES).nullable().optional(),
});

const bulkCreateSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(200),
  roles: z.array(z.enum(USER_ROLES)).min(1),
  team: z.enum(TEAM_NAMES).nullable().optional(),
});

const patchSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  roles: z.array(z.enum(USER_ROLES)).min(1).optional(),
  team: z.enum(TEAM_NAMES).nullable().optional(),
  status: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.roles?.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  const bulkParsed = bulkCreateSchema.safeParse(body);
  if (bulkParsed.success) {
    const { emails, roles, team } = bulkParsed.data;
    const results: { email: string; created: boolean; updated: boolean }[] = [];
    for (const raw of emails) {
      const normalizedEmail = raw.trim().toLowerCase();
      const existing = await queryOne<{ id: string }>("SELECT id FROM users WHERE email = $1 AND profile_name = 'Default'", [normalizedEmail]);
      if (existing) {
        await query(
          "UPDATE users SET roles = $1, team = $2, status = true, updated_at = now() WHERE id = $3",
          [roles, team ?? null, existing.id]
        );
        results.push({ email: normalizedEmail, created: false, updated: true });
      } else {
        await query(
          `INSERT INTO users (email, profile_name, name, roles, team, status) VALUES ($1, 'Default', NULL, $2, $3, true)`,
          [normalizedEmail, roles, team ?? null]
        );
        results.push({ email: normalizedEmail, created: true, updated: false });
      }
    }
    return NextResponse.json({ ok: true, bulk: true, results });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, profileName, name, roles, team } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();
  const profile = (profileName ?? "Default").trim() || "Default";

  const existing = await queryOne<{ id: string; name: string | null; team: string | null }>(
    "SELECT id, name, team FROM users WHERE email = $1 AND profile_name = $2",
    [normalizedEmail, profile]
  );
  if (existing) {
    await query(
      "UPDATE users SET name = COALESCE($1, name), roles = $2, team = $3, status = true, updated_at = now() WHERE id = $4",
      [name ?? existing.name, roles, team ?? existing.team, existing.id]
    );
    return NextResponse.json({ ok: true, user: { ...existing, roles, team, profileName: profile }, updated: true });
  }

  const rows = await query<{ id: string; email: string; name: string | null; roles: string[]; team: string | null }>(
    `INSERT INTO users (email, profile_name, name, roles, team, status) VALUES ($1, $2, $3, $4, $5, true) RETURNING id, email, name, roles, team`,
    [normalizedEmail, profile, name ?? null, roles, team ?? null]
  );
  const user = rows[0];
  if (!user) return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  return NextResponse.json({ ok: true, user: { ...user, profileName: profile } });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.roles?.includes("SUPER_ADMIN")) {
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

  const { userId, email, name, roles, team, status } = parsed.data;
  const update: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (email !== undefined) {
    const normalized = email.trim().toLowerCase();
    const taken = await queryOne<{ id: string }>(
      "SELECT u.id FROM users u WHERE u.email = $1 AND u.id != $2 AND u.profile_name = (SELECT profile_name FROM users WHERE id = $2)",
      [normalized, userId]
    );
    if (taken) {
      return NextResponse.json({ error: "This email is already in use for this profile" }, { status: 400 });
    }
    update.push(`email = $${i++}`);
    params.push(normalized);
  }
  if (name !== undefined) {
    update.push(`name = $${i++}`);
    params.push(name || null);
  }
  if (roles !== undefined) {
    update.push(`roles = $${i++}`);
    params.push(roles);
  }
  if (team !== undefined) {
    update.push(`team = $${i++}`);
    params.push(team);
  }
  if (status !== undefined) {
    update.push(`status = $${i++}`);
    params.push(status);
  }

  if (update.length === 0) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  update.push("updated_at = now()");
  params.push(userId);
  await query(`UPDATE users SET ${update.join(", ")} WHERE id = $${i}`, params);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.roles?.includes("SUPER_ADMIN")) {
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

  await query("UPDATE users SET status = false, updated_at = now() WHERE id = $1", [userId]);
  return NextResponse.json({ ok: true });
}
