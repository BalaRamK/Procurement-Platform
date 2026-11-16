import { request as httpsRequest } from "https";
import type { IncomingMessage } from "http";
import { getProxyAgent } from "@/lib/node-proxy-agent";

/**
 * fetch() replacement for Microsoft (login / Graph) calls on a VM that only reaches the internet through
 * an HTTP proxy. Node's built-in fetch ignores HTTPS_PROXY; this tunnels through getProxyAgent() like the
 * app's Azure sign-in and Zoho calls do. Handles binary responses (workbook download) and redirects, and
 * falls back to plain fetch when no proxy is configured.
 */
type ProxiedInit = { method?: string; headers?: Record<string, string>; body?: string | URLSearchParams };

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 60_000;
const NO_BODY_STATUSES = new Set([101, 204, 205, 304]);

function describeError(e: unknown) {
  const err = e as { message?: string; cause?: { code?: string; message?: string } };
  const cause = err.cause?.code ?? err.cause?.message;
  return new Error(cause ? `${err.message ?? "request failed"} (${cause})` : (err.message ?? String(e)));
}

function send(url: string, init: { method?: string; headers: Record<string, string>; body?: string }, redirects: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers: Record<string, string> = { ...init.headers, Host: u.host };
    if (init.body !== undefined) headers["Content-Length"] = String(Buffer.byteLength(init.body));

    const req = httpsRequest(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: init.method ?? "GET",
        headers,
        agent: getProxyAgent(),
      },
      (res: IncomingMessage) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if ([301, 302, 303, 307, 308].includes(status) && location && redirects < MAX_REDIRECTS) {
          res.resume();
          const next = new URL(location, url);
          const nextHeaders = { ...init.headers };
          if (next.host !== u.host) {
            // Pre-signed download URLs must not receive the bearer token.
            for (const key of Object.keys(nextHeaders)) if (key.toLowerCase() === "authorization") delete nextHeaders[key];
          }
          const toGet = status === 303;
          resolve(send(next.href, { method: toGet ? "GET" : init.method, headers: nextHeaders, body: toGet ? undefined : init.body }, redirects + 1));
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const responseHeaders = new Headers();
          for (const [k, v] of Object.entries(res.headers)) {
            if (v != null) responseHeaders.set(k.toLowerCase(), Array.isArray(v) ? v.join(", ") : v);
          }
          resolve(
            new Response(NO_BODY_STATUSES.has(status) ? null : Buffer.concat(chunks), {
              status,
              statusText: res.statusMessage ?? "",
              headers: responseHeaders,
            })
          );
        });
        res.on("error", reject);
      }
    );
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error(`Request to ${u.host} timed out`)));
    req.on("error", reject);
    if (init.body !== undefined) req.write(init.body);
    req.end();
  });
}

export async function proxiedFetch(url: string, init: ProxiedInit = {}): Promise<Response> {
  const body = init.body == null ? undefined : String(init.body);
  if (!getProxyAgent()) {
    try {
      return await fetch(url, { method: init.method, headers: init.headers, body });
    } catch (e) {
      throw describeError(e);
    }
  }
  return send(url, { method: init.method, headers: init.headers ?? {}, body }, 0);
}
