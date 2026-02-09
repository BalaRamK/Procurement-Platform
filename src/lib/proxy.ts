/**
 * Configure Node's global fetch (undici) to use HTTP/HTTPS proxy from environment.
 * Required for the Azure AD provider's profile step, which uses fetch() to get the
 * user photo from Microsoft Graph. https.request uses our node-proxy-agent; fetch uses this.
 */
function setupProxy() {
  if (typeof window !== "undefined") return;
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (!proxy?.trim()) return;

  try {
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
