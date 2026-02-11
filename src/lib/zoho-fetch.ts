/**
 * Fetch helper for Zoho API calls.
 *
 * Proxy: We use UNDICI's ProxyAgent (from the "undici" npm package), not Node's
 * https agent. The proxy URL is read from HTTPS_PROXY or HTTP_PROXY env vars
 * (e.g. HTTP_PROXY=http://10.160.0.18:3128 in PM2 ecosystem.config.js).
 * Proxy is used only for allowlisted Zoho hosts.
 */

import type { RequestInit as UndiciRequestInit } from "undici";
import { ProxyAgent, fetch as undiciFetch } from "undici";

/** Hosts that are allowed to be requested through the proxy (e.g. Zoho Books/CRM). */
const PROXY_ALLOWED_HOSTS = new Set([
  "www.zoho.com",
  "zoho.com",
  "www.zoho.in",
  "zoho.in",
  "www.zohoapis.com",
  "zohoapis.com",
]);

function getProxyDispatcher(): ProxyAgent | undefined {
  if (typeof window !== "undefined") return undefined;
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (!proxy?.trim()) return undefined;
  return new ProxyAgent(proxy.trim());
}

function isUrlAllowedForProxy(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PROXY_ALLOWED_HOSTS.has(host);
  } catch {
    return false;
  }
}

export async function fetchWithProxy(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const dispatcher = getProxyDispatcher();
  const allowed = isUrlAllowedForProxy(url);
  if (dispatcher && allowed) {
    const opts: UndiciRequestInit = {
      ...(init && { method: init.method, headers: init.headers }),
      dispatcher,
    };
    return undiciFetch(url, opts) as unknown as Promise<Response>;
  }
  if (allowed && !dispatcher) {
    throw new Error(
      "Zoho request requires proxy but HTTPS_PROXY/HTTP_PROXY is not set. Set them in PM2 ecosystem.config.js env (e.g. HTTPS_PROXY=http://10.160.0.18:3128)."
    );
  }
  return fetch(url, init);
}
