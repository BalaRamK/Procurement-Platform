# Procurement Platform

Procurement ticketing platform with Azure AD SSO, RBAC, role-specific dashboards, Zoho Books integration, and audit logging.

## Stack

- **Next.js 14** (App Router), TypeScript, Tailwind CSS
- **NextAuth.js** with Azure AD provider
- **PostgreSQL** via `pg` (no Prisma)
- **Zoho Books API** for item lookup (Phase 4)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment**

   Copy `.env.example` to `.env` and set your values. (Use `.env` so Prisma CLI can read `DATABASE_URL`; Next.js loads `.env` as well.)

   - `DATABASE_URL` — PostgreSQL connection string (required for Prisma and the app)
   - `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID` — from Azure App Registration
   - `NEXTAUTH_SECRET` — e.g. `openssl rand -base64 32`
   - `NEXTAUTH_URL` — e.g. `http://localhost:3000`
   - Optional: `ZOHO_BOOKS_ACCESS_TOKEN`, `ZOHO_BOOKS_ORG_ID` for Zoho Books item lookup

3. **PostgreSQL (if not already running)**

   **Option A — Install and run locally**

   - Install: `winget install PostgreSQL.PostgreSQL.16` (during setup, set postgres password to `Admin123` to match `.env`, and use port 5432).
   - Start the PostgreSQL Windows service (Services app or `scripts/setup-postgres.ps1`).
   - Create the database: in PowerShell from project root run `.\scripts\setup-postgres.ps1`, or manually: `psql -U postgres -c "CREATE DATABASE procurement;"`.

   **Option B — Docker**

   From the project root:

   ```bash
   docker compose up -d
   ```

   Or with plain Docker: `docker run -d --name postgres-procurement -e POSTGRES_PASSWORD=Admin123 -e POSTGRES_DB=procurement -p 5432:5432 postgres:16`

   This starts PostgreSQL with the `procurement` database and matches the default `.env` (user `postgres`, password `Admin123`, port 5432).

4. **Database**

   Ensure `DATABASE_URL` in `.env` points at your running PostgreSQL, then run:

   ```bash
   npm run db:init
   ```

   This applies the schema in `sql/schema.sql`. Optional: seed sample data and grant super admin:

   ```bash
   npm run db:seed
   npx tsx scripts/grant-super-admin.ts your-admin@company.com
   ```

5. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Unauthenticated users are redirected to sign-in.

## Troubleshooting

- **"Can't reach database server at localhost:5432"** — PostgreSQL is not running. Start it using **Option B** above (`docker compose up -d`) or **Option A** (Windows service), then run `npm run db:init` and try sign-in again.
- **`url.parse()` deprecation warning** — Emitted by NextAuth.js or a dependency. It does not affect sign-in; you can ignore it or run with `node --no-deprecation` if needed.
- **ChunkLoadError: Loading chunk app/layout failed (timeout)** — Often caused by a stale or corrupted `.next` build, or by OneDrive syncing/locking the project folder. **Fix:** Stop the dev server, run `npm run clean`, then `npm run dev` again. If the project is under OneDrive, exclude the `.next` folder from sync or move the project outside OneDrive.

## Roles

- **Super Admin** — User management, all tickets
- **Requester** — Create and view own requests
- **Functional Head**, **L1 Approver**, **CFO**, **CDO** — Approve at respective stage
- **Production** — View tickets assigned to production

## Data access (RBAC)

Data access is enforced in **application code** (API routes and server components), not via PostgreSQL RLS:

- **Tickets**: Requesters see only their own (`requesterId`); approvers see only tickets in their queue (by `status` and `teamName`); Super Admin sees all.
- **Notifications**: Each user sees only notifications where `recipient` equals their email.
- **Admin (users, reports, email templates)**: Restricted to Super Admin.
- **Create ticket**: Allowed only for REQUESTER and SUPER_ADMIN.

All API routes validate the session and apply the above filters before returning data.

## Documentation

See [docs/PROCUREMENT-PLATFORM.md](docs/PROCUREMENT-PLATFORM.md) for the knowledge base and changelog.
