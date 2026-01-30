# Procurement Platform — Knowledge Base

This document tracks what has been built, changed, and deployed for the Procurement Ticketing Platform.

---

## Overview

- **Purpose**: Procurement ticketing platform with Azure AD SSO, RBAC, role-specific dashboards, Zoho Books integration, and audit logging.
- **Stack**: Next.js 14 (App Router), TypeScript, Tailwind CSS, NextAuth.js (Azure AD), PostgreSQL (Prisma), Zoho Books API.
- **Hosting**: Local development first; VM-based hosting when ready. Code pushed to VM on major changes.

---

## Changelog

### Initial setup
- Next.js 14 app with TypeScript, Tailwind CSS, App Router, `src/` directory.
- Prisma for PostgreSQL.
- Documentation: `docs/PROCUREMENT-PLATFORM.md` (this file).
- `.env.example` with all required and optional variables.
- `.gitignore`, `README.md` with setup instructions.

### Phase 1: Identity and Authentication (Azure AD) — Implemented
- **NextAuth.js** with Azure AD provider in `src/app/api/auth/[...nextauth]/route.ts`.
- **Env**: `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.
- **Sign-in**: On first sign-in, user is created in PostgreSQL with default role REQUESTER; disabled users cannot sign in.
- **Session**: Session callback loads `role` and `id` from PostgreSQL `users` table on every request so role changes by Super Admin take effect immediately.
- **Types**: `src/types/next-auth.d.ts` extends Session and JWT with `role` and `id`.
- **Sign-in page**: `src/app/auth/signin/page.tsx` — “Sign in with Microsoft” button.
- **Root**: `/` redirects to `/dashboard` if authenticated, else `/auth/signin`.

### Phase 2: RBAC Schema and Super Admin User Management — Implemented
- **Prisma schema** (`prisma/schema.prisma`):
  - `users`: id (UUID), email (unique), name, azure_id, role (enum), **team** (Innovation/Engineering/Sales, for FH and L1), status (boolean), timestamps.
  - `tickets`: full set of mandatory and custom fields per FR 3.1; **teamName** (Request Type: Innovation/Engineering/Sales); **rejectionRemarks**; status lifecycle per FR 3.5.
  - `approval_logs`: id, ticketId, userEmail, userId?, action, **remarks**, createdAt.
  - **Comment** and **Notification** models for internal comments and notification audit.
  - **UserRole enum**: SUPER_ADMIN, REQUESTER, FUNCTIONAL_HEAD, L1_APPROVER, CFO, CDO, PRODUCTION.
  - **TeamName enum**: INNOVATION, ENGINEERING, SALES.
  - **TicketStatus enum** (FR 3.5): DRAFT, PENDING_FH_APPROVAL, PENDING_L1_APPROVAL, PENDING_CFO_APPROVAL, PENDING_CDO_APPROVAL, ASSIGNED_TO_PRODUCTION, DELIVERED_TO_REQUESTER, CONFIRMED_BY_REQUESTER, CLOSED, REJECTED.
- **Super Admin Dashboard**: User management with **Team** dropdown for FH and L1 users.
- **API**: `PATCH /api/admin/users` — body: `{ userId, role? }` or `{ userId, team? }` or `{ userId, status? }` — Super Admin only.

### Phase 3: Role-Specific User Dashboards — Implemented
- **Dashboard page**: Team-aware filtering (FR 3.3):
  - **FH**: only tickets with status PENDING_FH_APPROVAL and **ticket.teamName === user.team** (Innovation/Engineering).
  - **L1**: only tickets with status PENDING_L1_APPROVAL and **ticket.teamName === user.team** (Innovation/Engineering/Sales).
  - **Production**: tickets with status ASSIGNED_TO_PRODUCTION or DELIVERED_TO_REQUESTER.
- **Ticket visibility**: Request detail and APIs filter by role, **team** (for FH/L1), and ticket status/ownership.

### Phase 4: Zoho Books Integration for Parts and Costs — Implemented
- **Backend**: `GET /api/zoho/items?sku={id}` — calls Zoho Books API, returns `{ found, name?, rate?, unit?, sku? }`.
- **Purchase Request form** (FR 3.1): All mandatory and custom fields:
  - **Mandatory**: Requester name, Department, Item description, Estimated cost, Quantity, Team (Request type).
  - **Custom**: Component description, BOM ID / Product ID, Project/Customer, Need by date, Charge code, Cost (USD/INR/EUR), Estimated PO date, Place of delivery, Deal name, Priority.
  - BOM/Product ID lookup from Zoho Books; on match, item name, rate, unit auto-filled and read-only.
  - **Team (Request type)** drives assignment: Sales → L1 Sales; Engineering/Innovation → FH then L1 (FR 3.3).

### Phase 5: Secure Middleware and Audit Logging — Implemented
- **Middleware**: Protects routes; `/admin/*` restricted to Super Admin.
- **Audit**: `logApproval({ ticketId, userEmail, userId?, action, remarks? })`; **rejection requires mandatory remarks** (FR 3.5).
- **Approval flow** (FR 3.4): FH → L1 → CFO → CDO → Assigned to Production. Sales skips FH (goes to L1 Sales). On CDO approval, ticket → ASSIGNED_TO_PRODUCTION; Production can **Mark as delivered** → DELIVERED_TO_REQUESTER; Requester **Confirm receipt** → CLOSED. Rejection at any stage → REJECTED with remarks.
- **Notifications** (FR 7): `src/lib/notifications.ts` — `logNotification({ ticketId, type, recipient, payload? })`. Types: **on_creation** (to Requester), **assignment** (to Agent), **delivered** (to Requester), **closure** (to Requester), **team_assignment** (to team). Logged to `notifications` table; hook for email/SMS later.
- **Auto-close** (FR 3.4): `GET /api/cron/auto-close` — closes tickets in DELIVERED_TO_REQUESTER for &gt; 48 hours without confirmation. Secure with `Authorization: Bearer CRON_SECRET`. Run via cron (e.g. hourly).

### Additional files
- **Request detail**: All ticket fields, rejection remarks, **internal comments** (FR 3.6), and actions: Submit, Approve, Reject (with mandatory remarks), Mark as delivered (Production), Confirm receipt (Requester).
- **Comments**: `GET/POST /api/requests/[id]/comments` — internal comments for approvals/clarifications. `TicketComments` component on request detail page.
- **APIs**: `GET/POST /api/requests`, `GET/PATCH /api/requests/[id]` — role- and team-based filtering; submit sets status to PENDING_FH_APPROVAL (Engineering/Innovation) or PENDING_L1_APPROVAL (Sales).

### Ticket lifecycle and role labels
- **Lifecycle** (per requirements): Open → Pending FH Approval → Pending L1 Approval → Pending CFO Approval → Pending CDO Approval → Assigned to Production → Delivered to Requester → Confirmed by Requester → Closed. On rejection: Rejected with mandatory remarks. DRAFT is shown as **Open** in the UI.
- **Role labels** (user-facing): Requester, **Department Head** (first-level approval), **L1 Approver** (second-level), **Finance Team** (CFO), CDO, **Procurement Team** (Production), **Admin** (Super Admin). Centralized in `src/lib/constants.ts` (ROLE_LABELS, STATUS_LABELS).
- **Admin user CRUD** (Admin only): `/admin` — list users with email, name, role, team, status. **Add user**: `/admin/users/new` or "Add user" button; POST `/api/admin/users` (email, name, role, team). **Edit user**: "Edit" link → `/admin/users/[id]/edit`; PATCH `/api/admin/users` (userId, email?, name?, role?, team?, status?). **Delete**: "Delete" button calls DELETE `/api/admin/users?userId=xxx` (soft-delete: sets status=false; cannot delete self).
- **Email templates** (Admin only): `/admin/email-templates` — add/edit/delete auto email templates. Each template has: name, trigger (e.g. request_created, request_rejected, pending_fh_reminder), subject/body templates (placeholders: `{{requesterName}}`, `{{ticketId}}`, `{{ticketTitle}}`, `{{status}}`, `{{rejectionRemarks}}`), timeline (immediate, after_24h, after_48h, custom with delay minutes), and enabled. API: GET/POST `/api/admin/email-templates`, GET/PATCH/DELETE `/api/admin/email-templates/[id]`. Table `email_templates` in Prisma schema. **Wiring**: When a notification is logged (request created, delivered, closed, etc.) or on rejection, `src/lib/email.ts` looks up an enabled template for that trigger with timeline "immediate", replaces placeholders with ticket/requester data, and sends (stub logs to console; set `RESEND_API_KEY` to send real emails when implemented).
- **Reports & SLA page** (Admin only): `/admin/reports` — tickets by status (counts), recent tickets table, summary cards, SLA configuration placeholders.

### UI overhaul and sample data
- **Design system**: `tailwind.config.ts` extended with primary (indigo) palette, card shadows, border radius. `src/app/globals.css` with `@layer components` for `.input-base`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-success`, `.card`, `.nav-link` / `.nav-link-active`.
- **Layout**: Sidebar navigation (`src/components/layout/AppSidebar.tsx`) with logo, Dashboard and User management (Super Admin) links, signed-in user and Sign out. Dashboard and Admin layouts use the same sidebar.
- **Sign-in**: Centered card, gradient background, primary button.
- **Dashboards**: Page titles with short descriptions, card-wrapped tables, status badges (`src/components/ui/StatusBadge.tsx`) with color by status (draft, pending, approved, rejected, production, completed). Improved table headers and row hover.
- **Request detail**: Card layout with header (title + status badge), definition list grid for requester, created, item, rate/qty, and action buttons in a footer strip.
- **Forms**: Purchase request form with section heading, `input-base` styling, placeholders, and primary/secondary buttons. Admin user management: styled selects and status toggles.
- **Seed data**: `prisma/seed.ts` — 6 sample users (admin, requester, FH, L1, CFO, production) and 5 sample tickets (various statuses). Run with `npm run db:seed`. Seed skips if users already exist. Added `tsx` devDependency for running the seed. Requesters can **submit** a DRAFT ticket (PATCH `{ action: "submit" }`) to move it to PENDING_FH.

---

## Phase Summary (for quick reference)

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Azure AD SSO, session role from PostgreSQL | Done |
| 2 | Users table, roles enum, Super Admin user management | Done |
| 3 | Role-specific dashboards (Requester, Approvers, Production) | Done |
| 4 | Zoho Books item lookup, Purchase Request form (read-only when found) | Done |
| 5 | Middleware (auth + /admin Super Admin), approval_logs audit | Done |

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AZURE_AD_CLIENT_ID` | Yes | Azure AD app client ID |
| `AZURE_AD_CLIENT_SECRET` | Yes | Azure AD app client secret |
| `AZURE_AD_TENANT_ID` | Yes | Azure AD tenant ID |
| `NEXTAUTH_SECRET` | Yes | Secret for NextAuth (e.g. `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Yes | App URL (e.g. `http://localhost:3000`) |
| `ZOHO_BOOKS_ACCESS_TOKEN` | No | Zoho Books OAuth token for item lookup |
| `ZOHO_BOOKS_ORG_ID` | No | Zoho Books organization ID |

---

## Azure AD API permissions

**Yes — you should allow a small set of delegated permissions** so users can sign in and the app can read their identity (email, name) for the session and the `users` table.

Use **delegated permissions** only (no application permissions). In **Azure Portal** → **Microsoft Entra ID** (or Azure Active Directory) → **App registrations** → your app → **API permissions**:

1. **Add a permission** → **Microsoft Graph** → **Delegated permissions**.
2. Add these (and no others for SSO-only):

| Permission | Purpose |
|------------|---------|
| **openid** | Required for OpenID Connect sign-in (ID token). |
| **profile** | Read user’s display name so we can show/store name. |
| **email** | Read user’s email for session and `users.email` (required for RBAC). |

**Optional:** **User.Read** is often added by default; it covers sign-in and basic profile. If you already have **User.Read**, you typically have enough for SSO. You can add **email** explicitly if the token does not include email.

**Do not add** (not needed for this app):

- Application permissions (e.g. `User.Read.All`) — the app does not act without a signed-in user.
- Mail, Calendar, Files, or other Graph scopes — the platform only needs sign-in and basic profile/email.

After adding permissions, use **Grant admin consent** if your tenant requires it so users are not prompted for consent for these scopes.

---

## VM deployment (when ready)

- Set the same environment variables on the VM.
- Run `npm install`, `npx prisma generate`, `npx prisma migrate deploy` (or `prisma db push`).
- Run `npm run build` and `npm start` (or use PM2/systemd).
- Push code to VM on each major change and document the change in this file.

---

*Last updated: After implementing Phases 1–5.*
