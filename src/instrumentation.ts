/**
 * Next.js instrumentation: runs once when the Node process starts.
 * Schedules proactive Zoho Books token refresh every 45 minutes so the
 * access token is renewed before it expires (Zoho tokens typically last 1 hour).
 */

const ZOHO_REFRESH_INTERVAL_MS = 45 * 60 * 1000; // 45 minutes

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { refreshZohoBooksToken } = await import("@/lib/zoho-refresh");

  const runRefresh = () => {
    refreshZohoBooksToken().then((result) => {
      if (result.token) {
        console.log("[Zoho] Proactive token refresh OK");
      }
    });
  };

  // Refresh every 45 minutes
  setInterval(runRefresh, ZOHO_REFRESH_INTERVAL_MS);

  // Run once after a short delay so the in-memory token is fresh without blocking startup
  setTimeout(runRefresh, 10_000);
}
