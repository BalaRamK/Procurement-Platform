import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

/**
 * Debug: see what the server has for the current session and for your user in the DB.
 * Open in browser or: curl -b "next-auth.session-token=..." https://proc.qnulabs.com/api/auth/session-debug
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({
      ok: false,
      message: "Not signed in",
      session: null,
      dbUsers: null,
    });
  }

  let dbUsers: unknown[] = [];
  try {
    const rows = await query<Record<string, unknown>>(
      "SELECT * FROM users WHERE LOWER(email) = $1 ORDER BY created_at ASC",
      [email]
    );
    dbUsers = rows;
  } catch (e) {
    dbUsers = [{ error: String(e), hint: "Run npm run db:migrate-roles and db:migrate-profiles if you have an existing DB." }];
  }

  return NextResponse.json({
    ok: true,
    session: session
      ? {
          email: session.user?.email,
          id: session.user?.id,
          roles: session.user?.roles,
          team: session.user?.team,
        }
      : null,
    dbUsers,
    hint: dbUsers.length === 0 ? "No user row for this email. Sign in again to auto-create one, or add via User management." : undefined,
  });
}
