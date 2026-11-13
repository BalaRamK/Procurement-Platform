import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildAuthorizeUrl, getRedirectUri } from "@/lib/production-status-auth";

export const runtime = "nodejs";

/**
 * GET /api/production-status/connect — Super Admin starts connecting the workbook owner's Microsoft account.
 * The workbook owner signs in at the Microsoft prompt; the callback stores an encrypted refresh token.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildAuthorizeUrl(state));
  res.cookies.set("ps_oauth_state", state, {
    httpOnly: true,
    secure: getRedirectUri().startsWith("https"),
    sameSite: "lax",
    maxAge: 600,
    path: "/api/production-status",
  });
  return res;
}
