import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { query, queryOne } from "@/lib/db";

/**
 * Delegated Microsoft Graph access for the Production Status sync: a Super Admin connects the workbook
 * owner's Microsoft account once (Files.Read + offline_access); the refresh token is stored encrypted and
 * used by the daily sync. Uses the AZURE_AD_* sign-in app registration, which must have those two
 * delegated permissions and the redirect URI from getRedirectUri() registered.
 */
const SCOPE = "Files.Read offline_access";
export const RECONNECT_MESSAGE =
  "The Microsoft connection expired or was revoked. A Super Admin must reconnect at /api/production-status/connect";

function getAppConfig() {
  const tenant = process.env.AZURE_AD_TENANT_ID || "";
  const clientId = process.env.AZURE_AD_CLIENT_ID || "";
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET || "";
  if (!tenant || !clientId || !clientSecret) throw new Error("AZURE_AD_TENANT_ID / CLIENT_ID / CLIENT_SECRET are not set.");
  return { tenant, clientId, clientSecret };
}

export function getRedirectUri() {
  const base = (process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("NEXTAUTH_URL is not set.");
  return `${base}/api/production-status/callback`;
}

function encryptionKey() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set.");
  return createHash("sha256").update(secret).digest();
}

function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

function decrypt(b64: string) {
  try {
    const buf = Buffer.from(b64, "base64");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    throw new Error(RECONNECT_MESSAGE); // e.g. NEXTAUTH_SECRET changed since the token was stored
  }
}

async function ensureAuthTable() {
  await query(`CREATE TABLE IF NOT EXISTS production_status_auth (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    refresh_token_enc TEXT NOT NULL,
    account_name TEXT,
    connected_by TEXT,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    refreshed_at TIMESTAMPTZ
  )`);
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

async function requestToken(params: Record<string, string>) {
  const cfg = getAppConfig();
  const res = await fetch(`https://login.microsoftonline.com/${cfg.tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, scope: SCOPE, ...params }),
  });
  const json = (await res.json().catch(() => null)) as TokenResponse | null;
  if (!res.ok || !json?.access_token) {
    if (json?.error === "invalid_grant") throw new Error(RECONNECT_MESSAGE);
    throw new Error(`Microsoft token request failed: ${res.status} ${json?.error_description?.slice(0, 300) ?? ""}`);
  }
  return json as Required<Pick<TokenResponse, "access_token">> & TokenResponse;
}

export function buildAuthorizeUrl(state: string) {
  const cfg = getAppConfig();
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    redirect_uri: getRedirectUri(),
    response_mode: "query",
    scope: SCOPE,
    state,
    prompt: "select_account", // the workbook owner picks their own account, not the admin's
  });
  return `https://login.microsoftonline.com/${cfg.tenant}/oauth2/v2.0/authorize?${params}`;
}

/** Exchange the authorization code, store the refresh token, and return the connected account's name. */
export async function connectWithAuthCode(code: string, connectedBy: string | null | undefined) {
  const token = await requestToken({ grant_type: "authorization_code", code, redirect_uri: getRedirectUri() });
  if (!token.refresh_token) throw new Error("Microsoft did not return a refresh token (offline_access missing).");

  const driveRes = await fetch("https://graph.microsoft.com/v1.0/me/drive?$select=owner", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!driveRes.ok) throw new Error(`Could not read the account's OneDrive: ${driveRes.status} ${await driveRes.text()}`);
  const drive = (await driveRes.json()) as { owner?: { user?: { displayName?: string; email?: string } } };
  const accountName = drive.owner?.user?.email || drive.owner?.user?.displayName || null;

  await ensureAuthTable();
  await query(
    `INSERT INTO production_status_auth (id, refresh_token_enc, account_name, connected_by, connected_at, refreshed_at)
     VALUES (1, $1, $2, $3, now(), now())
     ON CONFLICT (id) DO UPDATE SET refresh_token_enc = $1, account_name = $2, connected_by = $3, connected_at = now(), refreshed_at = now()`,
    [encrypt(token.refresh_token), accountName, connectedBy ?? null]
  );
  cachedToken = { value: token.access_token, expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000 };
  return accountName;
}

export async function getConnectionInfo() {
  await ensureAuthTable();
  return queryOne<{ accountName: string | null; connectedBy: string | null; connectedAt: string; refreshedAt: string | null }>(
    `SELECT account_name, connected_by, connected_at, refreshed_at FROM production_status_auth WHERE id = 1`
  );
}

let cachedToken: { value: string; expiresAt: number } | null = null;
let inFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  await ensureAuthTable();
  const row = await queryOne<{ refreshTokenEnc: string }>(`SELECT refresh_token_enc FROM production_status_auth WHERE id = 1`);
  if (!row) return null;
  const token = await requestToken({ grant_type: "refresh_token", refresh_token: decrypt(row.refreshTokenEnc) });
  // Microsoft rotates refresh tokens; always keep the newest one.
  if (token.refresh_token) {
    await query(`UPDATE production_status_auth SET refresh_token_enc = $1, refreshed_at = now() WHERE id = 1`, [
      encrypt(token.refresh_token),
    ]);
  }
  cachedToken = { value: token.access_token, expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000 };
  return token.access_token;
}

/** Access token for the connected account, or null if nobody has connected one yet. */
export function getDelegatedAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return Promise.resolve(cachedToken.value);
  inFlight ??= refreshAccessToken().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
