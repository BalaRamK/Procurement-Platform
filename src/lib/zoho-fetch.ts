/**
 * Fetch helper for Zoho API calls. Uses the same proxy as Azure AD (Node https
 * agent from getProxyAgent) so requests work behind a corporate proxy. Proxy
 * is used only for allowlisted Zoho hosts. Requests to zohoapis.in / zohoapis.com
 * bypass the proxy (direct HTTPS) when the proxy blocks them with 403.
 */

import { getProxyAgent } from "@/lib/node-proxy-agent";

/** Hosts that are allowed to be requested through the proxy. */
const PROXY_ALLOWED_HOSTS = new Set([
  "www.zoho.com",
  "zoho.com",
  "www.zoho.in",
  "zoho.in",
  "www.zoho.eu",
  "zoho.eu",
  "books.zoho.com",
  "books.zoho.in",
  "books.zoho.eu",
  "accounts.zoho.com",
  "accounts.zoho.in",
  "accounts.zoho.eu",
  "www.zohoapis.com",
  "zohoapis.com",
  "www.zohoapis.in",
  "zohoapis.in",
]);

/** Bypass proxy for these hosts (direct HTTPS) when proxy returns 403 for zohoapis. */
const ZOHOAPIS_BYPASS_PROXY = new Set([
  "www.zohoapis.com",
  "zohoapis.com",
  "www.zohoapis.in",
  "zohoapis.in",
]);

function getHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isUrlAllowedForProxy(url: string): boolean {
  const host = getHost(url);
  return host != null && PROXY_ALLOWED_HOSTS.has(host);
}

function isZohoapisHost(url: string): boolean {
  const host = getHost(url);
  return host != null && ZOHOAPIS_BYPASS_PROXY.has(host);
}

const MAX_REDIRECTS = 3;

/** Timeout for Zoho API requests (ms). Keep below gateway timeout so we return a clear error. */
const ZOHO_REQUEST_TIMEOUT_MS = 25_000;

function httpsRequest(
  url: string,
  init?: RequestInit,
  redirectCount = 0,
  useProxy = true
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const agent = useProxy ? getProxyAgent() : undefined;
    const path = u.pathname + u.search;
    const requestHeaders: Record<string, string> = { ...(init?.headers as Record<string, string> | undefined) } || {};
    requestHeaders.Host = u.hostname;
    const options: import("https").RequestOptions = {
      hostname: u.hostname,
      port: u.port || 443,
      path,
      method: init?.method ?? "GET",
      headers: requestHeaders,
      agent: agent ?? undefined,
    };

    const https = require("https") as typeof import("https");
    const req = https.request(options, (res: import("http").IncomingMessage) => {
      const status = res.statusCode ?? 0;
      const isRedirect = (status === 301 || status === 302) && redirectCount < MAX_REDIRECTS;
      const location = res.headers.location;

      if (isRedirect && location) {
        const nextUrl = location.startsWith("http")
          ? location
          : new URL(location, url).href;
        res.destroy();
        if (isUrlAllowedForProxy(nextUrl) || isZohoapisHost(nextUrl)) {
          resolve(httpsRequest(nextUrl, init, redirectCount + 1, useProxy));
          return;
        }
      }

      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf-8");
        const headers = new Headers();
        for (const [k, v] of Object.entries(res.headers)) {
          if (v != null) headers.set(k.toLowerCase(), Array.isArray(v) ? v.join(", ") : v);
        }
        resolve(
          new Response(body, {
            status,
            statusText: res.statusMessage ?? "",
            headers,
          })
        );
      });
      res.on("error", reject);
    });
    req.setTimeout(ZOHO_REQUEST_TIMEOUT_MS, () => {
      if (!req.destroyed) {
        req.destroy(new Error("Zoho request timed out"));
      }
    });
    req.on("error", reject);
    const body = init?.body;
    if (body != null && body !== "") {
      const str = typeof body === "string" ? body : new TextDecoder().decode(body as ArrayBuffer);
      req.write(str, "utf-8");
    }
    req.end();
  });
}

export async function fetchWithProxy(
  url: string,
  init?: RequestInit
): Promise<Response> {
  if (typeof window !== "undefined") {
    return fetch(url, init);
  }
  // zohoapis: try direct first (avoids proxy 403); if direct fails (ETIMEDOUT, etc.), retry via proxy.
  if (isZohoapisHost(url)) {
    try {
      return await httpsRequest(url, init, 0, false);
    } catch (directErr) {
      const msg = directErr instanceof Error ? directErr.message : String(directErr);
      const connectionFailed =
        /ETIMEDOUT|ECONNREFUSED|ENOTFOUND|ENETUNREACH|Zoho request timed out/i.test(msg);
      if (connectionFailed && getProxyAgent()) {
        return await httpsRequest(url, init, 0, true);
      }
      throw directErr;
    }
  }
  const allowed = isUrlAllowedForProxy(url);
  if (allowed && !getProxyAgent()) {
    throw new Error(
      "Zoho request requires proxy but HTTPS_PROXY/HTTP_PROXY is not set. Set them in PM2 ecosystem.config.js env (e.g. HTTPS_PROXY=http://10.160.0.18:3128)."
    );
  }
  if (allowed) {
    return httpsRequest(url, init, 0, true);
  }
  return fetch(url, init);
}
