/**
 * Fetch helper for Zoho API calls. Uses the same proxy as Azure AD (Node https
 * agent from getProxyAgent) so requests work behind a corporate proxy. Proxy
 * is used only for allowlisted Zoho hosts.
 */

import { getProxyAgent } from "@/lib/node-proxy-agent";

/** Hosts that are allowed to be requested through the proxy. */
const PROXY_ALLOWED_HOSTS = new Set([
  "www.zoho.com",
  "zoho.com",
  "www.zoho.in",
  "zoho.in",
  "www.zohoapis.com",
  "zohoapis.com",
]);

function isUrlAllowedForProxy(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PROXY_ALLOWED_HOSTS.has(host);
  } catch {
    return false;
  }
}

function httpsRequest(
  url: string,
  init?: RequestInit
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const agent = getProxyAgent();
    const options: import("https").RequestOptions = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: init?.method ?? "GET",
      headers: init?.headers as Record<string, string> | undefined,
      agent: agent ?? undefined,
    };

    const https = require("https") as typeof import("https");
    const req = https.request(options, (res: import("http").IncomingMessage) => {
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
            status: res.statusCode ?? 0,
            statusText: res.statusMessage ?? "",
            headers,
          })
        );
      });
      res.on("error", reject);
    });
    req.on("error", reject);
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
  const allowed = isUrlAllowedForProxy(url);
  if (allowed && !getProxyAgent()) {
    throw new Error(
      "Zoho request requires proxy but HTTPS_PROXY/HTTP_PROXY is not set. Set them in PM2 ecosystem.config.js env (e.g. HTTPS_PROXY=http://10.160.0.18:3128)."
    );
  }
  if (allowed) {
    return httpsRequest(url, init);
  }
  return fetch(url, init);
}
