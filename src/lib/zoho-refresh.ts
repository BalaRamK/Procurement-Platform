/**
 * Zoho Books token refresh. When the access token expires (401), use the
 * refresh token to get a new access token and retry.
 *
 * Requires in .env: ZOHO_BOOKS_REFRESH_TOKEN, ZOHO_BOOKS_CLIENT_ID, ZOHO_BOOKS_CLIENT_SECRET.
 * Optional: ZOHO_BOOKS_ACCOUNTS_SERVER (e.g. https://accounts.zoho.in for India).
 */

import { fetchWithProxy } from "@/lib/zoho-fetch";

let refreshedAccessToken: string | null = null;

/**
 * Returns the access token to use: in-memory refreshed token if set, else env.
 */
export function getEffectiveAccessToken(): string | null {
  if (refreshedAccessToken?.trim()) return refreshedAccessToken.trim();
  const env = process.env.ZOHO_BOOKS_ACCESS_TOKEN?.trim();
  return env || null;
}

/**
 * Refreshes the Zoho Books access token using the refresh token.
 * On success, updates in-memory token (and process.env for current process) and returns the new token.
 * Returns null if refresh is not configured or fails.
 */
export async function refreshZohoBooksToken(): Promise<string | null> {
  const refreshToken = process.env.ZOHO_BOOKS_REFRESH_TOKEN?.trim();
  const clientId = process.env.ZOHO_BOOKS_CLIENT_ID?.trim();
  const clientSecret = process.env.ZOHO_BOOKS_CLIENT_SECRET?.trim();

  if (!refreshToken || !clientId || !clientSecret) {
    return null;
  }

  const accountsServer =
    process.env.ZOHO_BOOKS_ACCOUNTS_SERVER?.trim() ||
    "https://accounts.zoho.com";
  const tokenUrl = `${accountsServer.replace(/\/$/, "")}/oauth/v2/token`;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
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
  } catch {
    return null;
  }

  const text = await res.text();
  let data: { access_token?: string; refresh_token?: string; error?: string } = {};
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    return null;
  }

  if (!res.ok || data.error) {
    return null;
  }

  const newAccessToken = data.access_token?.trim();
  if (!newAccessToken) return null;

  refreshedAccessToken = newAccessToken;
  process.env.ZOHO_BOOKS_ACCESS_TOKEN = newAccessToken;
  if (data.refresh_token?.trim()) {
    process.env.ZOHO_BOOKS_REFRESH_TOKEN = data.refresh_token.trim();
  }
  return newAccessToken;
}
