const path = require("path");

/**
 * PM2 ecosystem config for Procurement Platform (production on VM).
 * Start with: pm2 start ecosystem.config.js
 *
 * Ensure .env (or server env) has: DATABASE_URL, AZURE_AD_*, NEXTAUTH_SECRET,
 * and optionally ZOHO_BOOKS_*, ZOHO_CRM_*.
 */
module.exports = {
  apps: [
    {
      name: "procurement",
      script: "npm",
      args: "start",
      cwd: path.join(__dirname),
      exec_mode: "fork",

      env: {
        NODE_ENV: "production",

        // Proxy (required when VM is behind corporate proxy)
        HTTP_PROXY: "http://10.160.0.18:3128",
        HTTPS_PROXY: "http://10.160.0.18:3128",
        NO_PROXY: "localhost,127.0.0.1,proc.qnulabs.com",

        // NextAuth – must match the public URL
        NEXTAUTH_URL: "https://proc.qnulabs.com",

        // Azure AD (set in .env on server; passed through here if defined)
        AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID,
        AZURE_AD_CLIENT_SECRET: process.env.AZURE_AD_CLIENT_SECRET,
        AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID,

        // Zoho (optional; set in .env if using Zoho Books/CRM)
        ZOHO_BOOKS_ACCESS_TOKEN: process.env.ZOHO_BOOKS_ACCESS_TOKEN,
        ZOHO_BOOKS_ORG_ID: process.env.ZOHO_BOOKS_ORG_ID,
        ZOHO_BOOKS_CLIENT_ID: process.env.ZOHO_BOOKS_CLIENT_ID,
        ZOHO_BOOKS_CLIENT_SECRET: process.env.ZOHO_BOOKS_CLIENT_SECRET,
        ZOHO_BOOKS_REFRESH_TOKEN: process.env.ZOHO_BOOKS_REFRESH_TOKEN,
        ZOHO_BOOKS_ACCOUNTS_SERVER: process.env.ZOHO_BOOKS_ACCOUNTS_SERVER,
      },
    },
  ],
};
