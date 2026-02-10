import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { asRolesArray } from "@/types/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ profiles: [], currentUserId: null }, { status: 200 });
  }
  const email = session.user.email.trim().toLowerCase();
  try {
    const rows = await query<{ id: string; profileName: string; roles: unknown }>(
      'SELECT id, profile_name AS "profileName", roles FROM users WHERE email = $1 AND status = true ORDER BY created_at ASC',
      [email]
    );
    const profiles = rows.map((r) => ({
      id: r.id,
      profileName: r.profileName,
      roles: asRolesArray(r.roles),
    }));
    return NextResponse.json({
      profiles,
      currentUserId: session.user.id ?? profiles[0]?.id ?? null,
    });
  } catch {
    return NextResponse.json({ profiles: [], currentUserId: session.user.id ?? null }, { status: 200 });
  }
}
