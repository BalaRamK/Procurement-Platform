import { NextRequest, NextResponse } from "next/server";
import { fetchWithProxy } from "@/lib/zoho-fetch";

/**
 * GET /api/zoho/callback
 * OAuth callback for Zoho Books: receives the authorization code from Zoho,
 * exchanges it for access_token and refresh_token, and shows them so you can
 * add to .env (ZOHO_BOOKS_ACCESS_TOKEN, ZOHO_BOOKS_REFRESH_TOKEN).
 *
 * Redirect URI in Zoho API Console must match: {NEXTAUTH_URL}/api/zoho/callback
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const location = req.nextUrl.searchParams.get("location") ?? "com";
  const errorParam = req.nextUrl.searchParams.get("error");

  if (errorParam) {
    const desc = req.nextUrl.searchParams.get("error_description") ?? errorParam;
    return htmlResponse(
      400,
      `Zoho returned an error: ${escapeHtml(desc)}. Check your Client ID, redirect URI, and scope.`
    );
  }

  if (!code?.trim()) {
    return htmlResponse(
      400,
      "Missing code. Use the authorization URL from the Zoho integration doc, sign in, and approve — Zoho will redirect back here with a code."
    );
  }

  const clientId = process.env.ZOHO_BOOKS_CLIENT_ID;
  const clientSecret = process.env.ZOHO_BOOKS_CLIENT_SECRET;
  const baseUrl = process.env.NEXTAUTH_URL ?? "";
  const redirectUri = `${baseUrl.replace(/\/$/, "")}/api/zoho/callback`;

  if (!clientId?.trim() || !clientSecret?.trim()) {
    return htmlResponse(
      503,
      "ZOHO_BOOKS_CLIENT_ID and ZOHO_BOOKS_CLIENT_SECRET must be set in .env (or server env). Add them from the Zoho API Console."
    );
  }

  const accountsHost =
    location === "in"
      ? "https://accounts.zoho.in"
      : location === "eu"
        ? "https://accounts.zoho.eu"
        : "https://accounts.zoho.com";
  const tokenUrl = `${accountsHost}/oauth/v2/token`;

  const body = new URLSearchParams({
    code: code.trim(),
    client_id: clientId.trim(),
    client_secret: clientSecret.trim(),
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  }).toString();

  let res: Response;
  try {
    res = await fetchWithProxy(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": String(Buffer.byteLength(body, "utf8")),
      },
      body,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return htmlResponse(502, `Request to Zoho failed: ${escapeHtml(msg)}`);
  }

  const text = await res.text();
  let data: { access_token?: string; refresh_token?: string; error?: string } = {};
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    return htmlResponse(502, `Zoho returned non-JSON: ${escapeHtml(text.slice(0, 200))}`);
  }

  if (!res.ok || data.error) {
    const msg = data.error ?? text.slice(0, 300);
    return htmlResponse(400, `Token exchange failed: ${escapeHtml(String(msg))}`);
  }

  const accessToken = data.access_token ?? "";
  const refreshToken = data.refresh_token ?? "";

  return htmlResponse(200, null, {
    title: "Zoho Books tokens",
    body: `
    <p><strong>Success.</strong> Add these to your <code>.env</code> (or server env) and restart the app.</p>
    <p><strong>ZOHO_BOOKS_ACCESS_TOKEN</strong> (use for API calls; expires in 1 hour):</p>
    <pre style="word-break:break-all; background:#f5f5f5; padding: 0.5rem;">${escapeHtml(accessToken)}</pre>
    <p><strong>ZOHO_BOOKS_REFRESH_TOKEN</strong> (use to get new access tokens; keep secret):</p>
    <pre style="word-break:break-all; background:#f5f5f5; padding: 0.5rem;">${escapeHtml(refreshToken)}</pre>
    <p>Then run <a href="/api/zoho/validate">/api/zoho/validate</a> (while logged in) to confirm.</p>
    `,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlResponse(
  status: number,
  errorMessage: string | null,
  success?: { title: string; body: string }
): NextResponse {
  const body = errorMessage
    ? `<p>${errorMessage}</p>`
    : success!.body;
  const title = success?.title ?? "Zoho callback";
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body style="font-family: sans-serif; max-width: 640px; margin: 2rem;">${body}</body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
