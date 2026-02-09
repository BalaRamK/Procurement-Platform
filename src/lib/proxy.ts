/**
 * Configure Node.js to use HTTP/HTTPS proxy from environment (HTTP_PROXY, HTTPS_PROXY).
 * Node's native fetch does not use proxy by default; this sets undici's global
 * dispatcher so fetch() calls (e.g. NextAuth Azure AD token exchange) use the proxy.
 * Load this module early on the server (e.g. from auth.ts) so sign-in works behind a corporate proxy.
 */

/**
 * function setupProxy() {
  if (typeof window !== "undefined") return; // browser: skip
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (!proxy) return;

  try {
    // Prefer Node's built-in undici (Node 18+) so global fetch uses the proxy
    const undici = require("node:undici") as typeof import("undici");
    if (undici.setGlobalDispatcher && undici.EnvHttpProxyAgent) {
      undici.setGlobalDispatcher(new undici.EnvHttpProxyAgent());
    }
  } catch {
    try {
      const undici = require("undici") as typeof import("undici");
      if (undici.setGlobalDispatcher && undici.EnvHttpProxyAgent) {
        undici.setGlobalDispatcher(new undici.EnvHttpProxyAgent());
      }
    } catch {
      // undici not available
    }
  }
}

setupProxy();
**/
