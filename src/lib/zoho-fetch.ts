/**
 * Fetch helper for Zoho API calls. Uses HTTP_PROXY/HTTPS_PROXY when set
 * so requests work from behind a corporate proxy (e.g. on the VM).
 * Proxy is used only for allowlisted hosts to avoid proxying arbitrary URLs.
 */

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
  if (dispatcher && isUrlAllowedForProxy(url)) {
    return undiciFetch(url, { ...init, dispatcher }) as Promise<Response>;
  }
  return fetch(url, init);
}
