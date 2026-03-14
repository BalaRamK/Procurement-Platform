import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

const ALLOWED_KEYS = ["smtp_host", "smtp_port", "smtp_from", "smtp_user", "smtp_pass", "smtp_proxy"] as const;
type SettingKey = (typeof ALLOWED_KEYS)[number];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.roles?.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await query<{ key: string; value: string | null }>(
    `SELECT key, value FROM app_settings WHERE key = ANY($1)`,
    [ALLOWED_KEYS]
  );

  const result: Record<string, string> = {};
  for (const row of rows) {
    // Never expose the password value — only signal whether it's set
    if (row.key === "smtp_pass") {
      result[row.key] = row.value ? "••••••••" : "";
    } else {
      result[row.key] = row.value ?? "";
    }
  }
  return NextResponse.json(result);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.roles?.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as Record<string, unknown>;

  for (const key of Object.keys(body)) {
    if (!ALLOWED_KEYS.includes(key as SettingKey)) {
      return NextResponse.json({ error: `Unknown setting key: ${key}` }, { status: 400 });
    }
  }

  for (const [key, value] of Object.entries(body)) {
    // Skip password if placeholder sent back (unchanged)
    if (key === "smtp_pass" && value === "••••••••") continue;

    await query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, value === "" ? null : String(value)]
    );
  }

  return NextResponse.json({ success: true });
}
