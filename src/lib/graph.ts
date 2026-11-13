/**
 * Microsoft Graph app-only (client credentials) access over HTTPS.
 * Uses GRAPH_* env vars, falling back to the AZURE_AD_* sign-in app registration.
 */
function getGraphAppConfig() {
  const tenant = process.env.GRAPH_TENANT_ID || process.env.AZURE_AD_TENANT_ID || "";
  const clientId = process.env.GRAPH_CLIENT_ID || process.env.AZURE_AD_CLIENT_ID || "";
  const clientSecret = process.env.GRAPH_CLIENT_SECRET || process.env.AZURE_AD_CLIENT_SECRET || "";
  if (!tenant || !clientId || !clientSecret) return null;
  return { tenant, clientId, clientSecret };
}

let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getGraphAppToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const cfg = getGraphAppConfig();
  if (!cfg) throw new Error("Graph credentials are not set (GRAPH_* or AZURE_AD_* env vars).");
  const res = await fetch(`https://login.microsoftonline.com/${cfg.tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`Graph token request failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

/** GET a Graph path (or full URL), with the app token unless a user token is given. Redirects (file downloads) are followed. */
export async function graphGet(pathOrUrl: string, userToken?: string): Promise<Response> {
  const token = userToken ?? (await getGraphAppToken());
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `https://graph.microsoft.com/v1.0${pathOrUrl}`;
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}
