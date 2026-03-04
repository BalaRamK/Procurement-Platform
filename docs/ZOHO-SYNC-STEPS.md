# Zoho Books sync — clear steps

Follow these in order.

---

## Step 1: Set `ZOHO_SYNC_CRON_SECRET` in `.env`

1. Open the `.env` file in the project root (create it from `.env.example` if it doesn’t exist).
2. Generate a random secret (e.g. run in terminal):
   ```bash
   openssl rand -base64 32
   ```
3. Add this line to `.env` (replace the value with the one you generated):
   ```env
   ZOHO_SYNC_CRON_SECRET="your-generated-secret-here"
   ```
4. Save the file.  
   **Important:** Use the same value in Step 3 when scheduling the weekly call. Don’t commit `.env` or share this secret.

---

## Step 2: Run the sync once

**Option A — On the server (recommended if the script runs where the app is deployed)**

Run the sync **directly** (no HTTP call, so no timeout to the public URL):

```bash
ZOHO_SYNC_DIRECT=1 npm run zoho:sync
```

You should see:
```text
Running Zoho Books sync directly (ZOHO_SYNC_DIRECT=1)...
OK: Zoho Books items synced, count: 123
```

The app does **not** need to be running for this. Ensure `.env` on the server has Zoho Books config (`ZOHO_BOOKS_ACCESS_TOKEN` or refresh token + client id/secret, `ZOHO_BOOKS_ORG_ID`) and `DATABASE_URL`.

**Option B — Via API (e.g. from your laptop)**

1. **Start the app** (in one terminal):
   ```bash
   npm run dev
   ```
   Or production: `npm run build` then `npm start`.

2. **Run the sync** (in a second terminal, from the project root):
   ```bash
   npm run zoho:sync
   ```
   This calls `POST NEXTAUTH_URL/api/zoho/sync`. Use this only when that URL is reachable (e.g. `http://localhost:3000` for dev). If you get **fetch failed** or **Connect Timeout**, use Option A instead (e.g. on the server run `ZOHO_SYNC_DIRECT=1 npm run zoho:sync`).

If you see an error, check that:
- Zoho Books is configured: `ZOHO_BOOKS_ACCESS_TOKEN` (or refresh token + client id/secret), `ZOHO_BOOKS_ORG_ID`.
- The database has the `zoho_books_items` table (run `npm run db:init` if you haven’t).

---

## Step 3: Schedule the weekly `POST /api/zoho/sync` call

Use **one** of the options below. Replace:

- `https://your-domain.com` with your real app URL (e.g. `https://proc.qnulabs.com`).
- `YOUR_ZOHO_SYNC_CRON_SECRET` with the exact value you set in Step 1.

### Option A: Server cron (Linux/macOS)

1. Open crontab:
   ```bash
   crontab -e
   ```
2. Add a line to run every **Sunday at 2:00 AM**:
   ```cron
   0 2 * * 0 curl -sS -X POST "https://your-domain.com/api/zoho/sync" -H "Authorization: Bearer YOUR_ZOHO_SYNC_CRON_SECRET"
   ```
3. Save and exit. The job will run weekly.

### Option B: cron-job.org (or similar)

1. Create an account at [cron-job.org](https://cron-job.org) (or another cron service).
2. Create a new cron job:
   - **URL:** `https://your-domain.com/api/zoho/sync`
   - **Method:** POST
   - **Schedule:** e.g. every week (Sunday).
   - **Headers:** Add:
     - Name: `Authorization`  
     - Value: `Bearer YOUR_ZOHO_SYNC_CRON_SECRET`
3. Save. The service will call your app weekly.

### Option C: Windows Task Scheduler

1. Open **Task Scheduler** → Create Basic Task.
2. Trigger: **Weekly** (e.g. Sunday, 2:00 AM).
3. Action: **Start a program**.
4. Program: `curl` (or full path to `curl.exe`).
5. Arguments:
   ```text
   -sS -X POST "https://your-domain.com/api/zoho/sync" -H "Authorization: Bearer YOUR_ZOHO_SYNC_CRON_SECRET"
   ```
6. Finish. The task will run weekly.

---

## Quick reference

| Step | What to do |
|------|------------|
| **1** | Add `ZOHO_SYNC_CRON_SECRET="<random-secret>"` to `.env`. |
| **2** | Run sync once: **on server** `ZOHO_SYNC_DIRECT=1 npm run zoho:sync` (no app needed). Or via API: start app then `npm run zoho:sync`. |
| **3** | Schedule weekly `POST https://your-domain.com/api/zoho/sync` with header `Authorization: Bearer <same-secret>`. |
