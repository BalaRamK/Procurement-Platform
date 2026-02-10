/**
 * Proxy for outbound HTTPS (e.g. Azure AD token) is handled by node-proxy-agent in auth.
 * We no longer set undici's global dispatcher here to avoid UNDICI-EHPA experimental
 * warnings. The Azure AD profile uses token claims only (no Microsoft Graph fetch).
 */
