import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { tryTokenExchangeWithServer } from "@/lib/zoho-refresh";

const GLOBAL_SERVER = "https://accounts.zoho.com";
const INDIA_SERVER = "https://accounts.zoho.in";

/**
 * GET /api/zoho/check-credentials
 * Tries the same token (refresh) request against both Zoho accounts servers
 * (global and India) and returns which one accepts your client ID/secret/refresh token.
 * Does not change any stored token. Use to verify credentials and pick the right server.
 */
export async function GET(req: NextRequest) {
  const authToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!authToken?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [globalResult, indiaResult] = await Promise.all([
    tryTokenExchangeWithServer(GLOBAL_SERVER),
    tryTokenExchangeWithServer(INDIA_SERVER),
  ]);

  const working = globalResult.hasAccessToken ? GLOBAL_SERVER : indiaResult.hasAccessToken ? INDIA_SERVER : null;

  return NextResponse.json({
    success: !!working,
    workingServer: working,
    message: working
      ? working === INDIA_SERVER
        ? "Credentials work with India server. Set ZOHO_BOOKS_ACCOUNTS_SERVER=https://accounts.zoho.in and restart."
        : "Credentials work with global server. Default (or ZOHO_BOOKS_ACCOUNTS_SERVER=https://accounts.zoho.com) is correct."
      : "Neither server accepted the credentials. See results below.",
    results: {
      [GLOBAL_SERVER]: {
        ok: globalResult.ok,
        hasAccessToken: globalResult.hasAccessToken,
        error: globalResult.error,
        errorDescription: globalResult.errorDescription,
      },
      [INDIA_SERVER]: {
        ok: indiaResult.ok,
        hasAccessToken: indiaResult.hasAccessToken,
        error: indiaResult.error,
        errorDescription: indiaResult.errorDescription,
      },
    },
  });
}
