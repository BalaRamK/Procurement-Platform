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

export type RefreshResult =
  | { token: string; error?: never; hint?: never; diagnostics?: never }
  | {
      token: null;
      error: string;
      hint?: string;
      /** When error is invalid_client_secret, helps verify env is loaded correctly (no secret value exposed). */
      diagnostics?: {
        clientIdLength: number;
        clientSecretLength: number;
        accountsServer: string;
        hasClientSecretNewline: boolean;
        note: string;
      };
    };

/**
 * Refreshes the Zoho Books access token using the refresh token.
 * On success, updates in-memory token (and process.env for current process) and returns the new token.
 * On failure, returns { token: null, error, hint } so callers can show why refresh failed.
 */
export async function refreshZohoBooksToken(): Promise<RefreshResult> {
  const refreshToken = process.env.ZOHO_BOOKS_REFRESH_TOKEN?.trim();
  const clientId = process.env.ZOHO_BOOKS_CLIENT_ID?.trim();
  const clientSecret = process.env.ZOHO_BOOKS_CLIENT_SECRET?.trim();

  if (!refreshToken || !clientId || !clientSecret) {
    const missing = [
      !refreshToken && "ZOHO_BOOKS_REFRESH_TOKEN",
      !clientId && "ZOHO_BOOKS_CLIENT_ID",
      !clientSecret && "ZOHO_BOOKS_CLIENT_SECRET",
    ].filter(Boolean) as string[];
    console.warn("[Zoho Refresh] Not configured:", missing.join(", "));
    return {
      token: null,
      error: "Token refresh not configured",
      hint: `Set ${missing.join(", ")} in your environment (e.g. .env or ecosystem.config.js). Use the OAuth callback to get a refresh token.`,
    };
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Zoho Refresh] Request failed:", msg);
    return {
      token: null,
      error: "Refresh request failed",
      hint: msg,
    };
  }

  const text = await res.text();
  let data: { access_token?: string; refresh_token?: string; error?: string; error_description?: string } = {};
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    console.error("[Zoho Refresh] Non-JSON response:", text.slice(0, 200));
    return {
      token: null,
      error: "Zoho token endpoint returned non-JSON",
      hint: text.slice(0, 200),
    };
  }

  if (!res.ok || data.error) {
    const zohoError = data.error ?? `HTTP ${res.status}`;
    const zohoDesc = data.error_description ?? text.slice(0, 150);
    console.error("[Zoho Refresh] Zoho error:", zohoError, zohoDesc);

    const isInvalidSecret = zohoError === "invalid_client_secret" || zohoError === "invalid_client";
    const rawSecret = process.env.ZOHO_BOOKS_CLIENT_SECRET ?? "";
    const diagnostics = isInvalidSecret
      ? {
          clientIdLength: (process.env.ZOHO_BOOKS_CLIENT_ID ?? "").length,
          clientSecretLength: rawSecret.length,
          accountsServer: process.env.ZOHO_BOOKS_ACCOUNTS_SERVER?.trim() || "https://accounts.zoho.com (default)",
          hasClientSecretNewline: rawSecret.includes("\n") || rawSecret.includes("\r"),
          note: "Verify: (1) Client secret is from the same Zoho app as Client ID. (2) No extra newline when pasting in .env / ecosystem. (3) If in ecosystem.config.js, escape quotes/backslashes in the value. (4) For India org use ZOHO_BOOKS_ACCOUNTS_SERVER=https://accounts.zoho.in",
        }
      : undefined;

    const hintMessage =
      zohoDesc ||
      (res.status === 401 ? "Refresh token may be expired or revoked. Re-run the OAuth flow to get a new refresh token." : undefined) ||
      (diagnostics ? "See diagnostics below to verify your env (client ID/secret lengths, newlines, accounts server)." : undefined);

    return {
      token: null,
      error: zohoError,
      hint: hintMessage,
      diagnostics,
    };
  }

  const newAccessToken = data.access_token?.trim();
  if (!newAccessToken) {
    return {
      token: null,
      error: "No access_token in refresh response",
      hint: text.slice(0, 150),
    };
  }

  refreshedAccessToken = newAccessToken;
  process.env.ZOHO_BOOKS_ACCESS_TOKEN = newAccessToken;
  if (data.refresh_token?.trim()) {
    process.env.ZOHO_BOOKS_REFRESH_TOKEN = data.refresh_token.trim();
  }
  return { token: newAccessToken };
}
