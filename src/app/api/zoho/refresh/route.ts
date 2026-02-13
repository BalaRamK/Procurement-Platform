import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { refreshZohoBooksToken } from "@/lib/zoho-refresh";

/**
 * GET /api/zoho/refresh
 * Manually trigger Zoho Books token refresh to verify refresh is configured and working.
 * Requires sign-in. Returns success/error and hint for debugging.
 */
export async function GET(req: NextRequest) {
  const authToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!authToken?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await refreshZohoBooksToken();

  if (result.token) {
    return NextResponse.json({
      success: true,
      message: "Token refreshed successfully",
      tokenLength: result.token.length,
    });
  }

  return NextResponse.json({
    success: false,
    error: result.error,
    hint: result.hint,
  });
}
