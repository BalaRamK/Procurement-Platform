# Zoho Books & Zoho CRM Integration — New Request

This guide covers how to integrate **Zoho Books** and **Zoho CRM** with the **New request** flow, and the field mappings between the Procurement Platform and both Zoho products.

---

## 1. Zoho Books integration

### 1.1 What’s already in the app

- **Item lookup by SKU / BOM ID / Product ID**  
  On the New request form, when the user enters a component name or BOM/Product ID and blurs the field, the app calls Zoho Books Items API and autofills (Zoho Books → Platform only):
  - **Component Name** (Zoho item name)
  - **Product name** (same as Zoho item name)
  - **BOM ID** and **Product ID** (from Zoho `sku`)
  - **Cost per item ($)** (Zoho rate)
  - **Item description** (Zoho description)
  - **Unit**

- **API used:** `GET /api/zoho/items?sku=<value>`
- **Zoho API:** `GET https://www.zoho.com/books/api/v3/items?organization_id={org_id}&sku={sku}`

### 1.2 Setup steps (Zoho Books)

1. **Create a Zoho Books organization** (if you don’t have one).
2. **Get OAuth credentials:**
   - Go to [Zoho API Console](https://api-console.zoho.com/).
   - Add a **Server-based Application** (or use existing).
   - Note **Client ID** and **Client Secret**.
   - Set redirect URI (e.g. `https://your-domain.com/api/zoho/callback` if you add OAuth flow).
3. **Get an access token:**
   - **Option A — Self Client (quick, for testing):** In the API Console, use [Self Client](https://www.zoho.com/accounts/protocol/oauth/self-client/overview.html): click **GET STARTED** → **Self Client** → **CREATE NOW**. Then in the **Generate Code** tab, enter scope `ZohoBooks.fullaccess.all` (or `ZohoBooks.settings.READ,ZohoBooks.items.READ`), create a code, and exchange it for an access token via `POST https://accounts.zoho.com/oauth/v2/token` (use `accounts.zoho.in` if your org is in India). You get a short-lived access token and a refresh token.
   - **Option B — Authorization code flow:** See [Option B step-by-step](#option-b--authorization-code-flow-step-by-step) below.
   - **Direct link to API Console:** [https://api-console.zoho.com](https://api-console.zoho.com) → choose your app (or create Self Client) → generate code / token as above.
4. **Get Organization ID:**

#### Option B — Authorization code flow (step-by-step)

Use this when you have a **Server-based Application** and want a long-lived **refresh token** so the app can get new access tokens without user sign-in each time.

1. **Register the app and redirect URI**
   - In [Zoho API Console](https://api-console.zoho.com), create or open a **Server-based Application**.
   - Note **Client ID** and **Client Secret**.
   - Under **Redirect URI**, add the exact URL where Zoho will send the user after they approve (e.g. `https://proc.qnulabs.com/api/zoho/callback` or `http://localhost:3000/api/zoho/callback` for local testing). It must match exactly (including scheme and path).

2. **Build the authorization URL and open it in a browser**
   - Use the **accounts server** for your region: **Global** `https://accounts.zoho.com`, **India** `https://accounts.zoho.in`, **EU** `https://accounts.zoho.eu`.
   - URL format:
     ```
     GET {accounts-server}/oauth/v2/auth?response_type=code&client_id={Client_ID}&scope=ZohoBooks.fullaccess.all&redirect_uri={Redirect_URI}&access_type=offline&prompt=consent
     ```
   - Replace:
     - `{accounts-server}` → e.g. `https://accounts.zoho.com` or `https://accounts.zoho.in`
     - `{Client_ID}` → your Client ID from the API console
     - `{Redirect_URI}` → same URI you registered (e.g. `https://proc.qnulabs.com/api/zoho/callback`), **URL-encoded**
   - Example (India):
     ```
     https://accounts.zoho.in/oauth/v2/auth?response_type=code&client_id=1000.XXXXX&scope=ZohoBooks.fullaccess.all&redirect_uri=https%3A%2F%2Fproc.qnulabs.com%2Fapi%2Fzoho%2Fcallback&access_type=offline&prompt=consent
     ```
   - Open this URL in a browser. Sign in to Zoho if asked, then approve the requested permissions.

3. **Capture the authorization code**
   - After the user approves, Zoho redirects to your `redirect_uri` with a **code** (and optionally **location**). Example:
     ```
     https://proc.qnulabs.com/api/zoho/callback?code=1000.abc123...&location=in
     ```
   - The **code** is valid for **2 minutes** and can be used only once. Copy the `code` query parameter.

4. **Exchange the code for access token and refresh token**
   - Send a **POST** request to the **token** endpoint. Use the accounts server that matches the user (if Zoho returned `location=in`, use `https://accounts.zoho.in`; otherwise `https://accounts.zoho.com` or `https://accounts.zoho.eu`).
   - Endpoint: `POST {accounts-server}/oauth/v2/token`
   - Body (application/x-www-form-urlencoded):
     - `code` = the authorization code from step 3
     - `client_id` = your Client ID
     - `client_secret` = your Client Secret
     - `redirect_uri` = same redirect URI used in step 2 (exact match)
     - `grant_type` = `authorization_code`
   - Example with curl (India):
     ```bash
     curl -X POST "https://accounts.zoho.in/oauth/v2/token" \
       -d "code=1000.xxxx_from_redirect" \
       -d "client_id=YOUR_CLIENT_ID" \
       -d "client_secret=YOUR_CLIENT_SECRET" \
       -d "redirect_uri=https://proc.qnulabs.com/api/zoho/callback" \
       -d "grant_type=authorization_code"
     ```

5. **Use the response**
   - The response includes:
     - **access_token** — use for API calls (header: `Authorization: Zoho-oauthtoken {access_token}`). Valid for 1 hour.
     - **refresh_token** — save this; the app uses it to refresh the access token automatically when it expires.
   - Put `access_token` in `ZOHO_BOOKS_ACCESS_TOKEN` and `refresh_token` in `ZOHO_BOOKS_REFRESH_TOKEN`. Also set `ZOHO_BOOKS_CLIENT_ID` and `ZOHO_BOOKS_CLIENT_SECRET`. The app will automatically refresh the access token when a Zoho API call returns 401 (token expired).
   - **India:** If your Zoho org is in India, set `ZOHO_BOOKS_ACCOUNTS_SERVER=https://accounts.zoho.in` so refresh uses the correct token endpoint.

**Note:** The app implements the callback at `/api/zoho/callback`. Set `ZOHO_BOOKS_CLIENT_ID` and `ZOHO_BOOKS_CLIENT_SECRET` in `.env`, and set the redirect URI in the API Console to `{NEXTAUTH_URL}/api/zoho/callback` (e.g. `https://proc.qnulabs.com/api/zoho/callback`). After you sign in and approve, Zoho redirects to that URL and the app exchanges the code for tokens and shows them so you can copy into `.env`. Automatic token refresh is not implemented yet.

4. **Get Organization ID:**
   - Zoho Books → **Settings** → **Organization Profile** → **Organization ID**.
5. **Configure environment variables** (in `.env` or server env):
   ```env
   ZOHO_BOOKS_ACCESS_TOKEN="<your_access_token>"
   ZOHO_BOOKS_ORG_ID="<your_organization_id>"
   ```
6. **Optional — refresh token:**  
   Access tokens expire. For production, implement refresh using `ZOHO_BOOKS_REFRESH_TOKEN` and `ZOHO_BOOKS_CLIENT_ID` / `ZOHO_BOOKS_CLIENT_SECRET`, and periodically replace `ZOHO_BOOKS_ACCESS_TOKEN`.
7. **Validate credentials:**  
   After configuring the env vars, open the app in your browser (use the **hosted URL** when the app runs on a VM, e.g. `https://your-vm-hostname-or-ip/api/zoho/validate`). You must be logged in. The response will indicate whether the access token and organization ID are valid.

8. **Test token refresh (optional):**  
   To verify that automatic refresh works when the access token expires, call **GET** `https://your-domain/api/zoho/refresh` while logged in. If refresh is configured correctly (refresh token, client ID, client secret, and correct `ZOHO_BOOKS_ACCOUNTS_SERVER` for your region), the response will be `{ "success": true, "message": "Token refreshed successfully" }`. Otherwise you get `success: false` with `error` and `hint`.

9. **Check credentials against both regions (optional):**  
   If you get `invalid_client_secret` and are unsure whether to use the global or India server, call **GET** `https://your-domain/api/zoho/check-credentials` while logged in. The API tries the same token request against **accounts.zoho.com** and **accounts.zoho.in** and returns which one accepted your client ID, client secret, and refresh token. No token is stored. Use the `workingServer` and `message` in the response to set `ZOHO_BOOKS_ACCOUNTS_SERVER` correctly.

### 1.3 Field mapping: Zoho Books → Procurement Platform (lookup only)

**Flow: Zoho Books → Procurement Platform only.** Nothing from the platform is sent to Zoho Books. When the user enters a BOM ID, Product ID, or Component name and blurs the field, the app looks up the item in Zoho Books and **autofills** the form with the mapped fields below.

| Platform field (New request form) | Zoho Books source        | Notes |
|-----------------------------------|---------------------------|--------|
| **Component Name**                | `items[].name`            | Product/item name from Zoho. |
| **Product name**                  | `items[].name`            | Same as Component Name (Zoho item name). |
| **BOM ID**                        | `items[].sku`             | Filled from Zoho when lookup returns a match. |
| **Product ID**                    | `items[].sku`             | Filled from Zoho when lookup returns a match. |
| **Cost per item ($)**             | `items[].rate`            | Unit price from Zoho. |
| **Item description**              | `items[].description`     | Item description from Zoho. |
| **Unit**                          | `items[].unit`            | e.g. pcs, set, box (shown in form context). |

**Lookup:** User types BOM ID, Product ID, or Component name and blurs the field → `GET /api/zoho/items?sku=<value>` → Zoho Books Items API → form is autofilled with the fields above. Quantity and Estimated Cost are entered on the platform only (not from Zoho).

**Zoho Books Items API (relevant fields):** `items[].item_id`, `items[].name`, `items[].sku`, `items[].rate`, `items[].unit`, `items[].description`

---

## 2. Zoho CRM integration

### 2.1 What the form expects (placeholders today)

The New request form has these fields with “Zoho CRM” placeholders; they are **not** wired to any API yet:

- **Project/Customer name**
- **Charge code**
- **Deal name**
- **Deal ID**

Goal: **search or select a Deal (or Account) in Zoho CRM** and autofill Project/Customer, Charge code, Deal name, Deal ID (and optionally other fields).

### 2.2 Setup steps (Zoho CRM)

1. **Zoho CRM account** with API access (same or different Zoho account from Books).
2. **Get OAuth credentials:**
   - [Zoho API Console](https://api-console.zoho.com/) → create or select a **Server-based Application** for **Zoho CRM**.
   - Note **Client ID**, **Client Secret**, **Redirect URI**.
3. **Get access token:**
   - Use OAuth 2.0 authorization code flow; scope for CRM: `ZohoCRM.modules.READ`, `ZohoCRM.settings.READ` (and `ZohoCRM.deals.READ` etc. as needed).
   - Store **Access Token** and **Refresh Token**.
4. **Configure environment variables:**
   ```env
   ZOHO_CRM_ACCESS_TOKEN="<access_token>"
   ZOHO_CRM_REFRESH_TOKEN="<refresh_token>"
   ZOHO_CRM_CLIENT_ID="<client_id>"
   ZOHO_CRM_CLIENT_SECRET="<client_secret>"
   ```
5. **Optional:** Determine **domain** (e.g. `www.zohoapis.com` or `www.zoho.in` for India). Default is `www.zohoapis.com`.

### 2.3 Field mapping: Procurement Platform ↔ Zoho CRM

| Procurement Platform (New request form) | Zoho CRM module / field           | Direction   | Notes |
|----------------------------------------|-----------------------------------|------------|--------|
| **Project/Customer name**               | Deals → **Account Name** (or Deal → **Account name**) | CRM → Form | Or use a custom field “Project/Customer” on Deal. |
| **Charge code**                         | Deal custom field (e.g. **Charge_Code**) or standard field | CRM → Form | Create in CRM if not present. |
| **Deal name**                           | Deals → **Deal Name**            | CRM → Form | Standard field. |
| **Deal ID**                             | Deals → **id**                   | CRM → Form | For linking back to CRM; store in app if needed. |

**Suggested Zoho CRM APIs to use:**

- **Search Deals:**  
  `GET https://www.zohoapis.com/crm/v2/Deals/search?criteria=(Deal_Name|Account_Name|Custom_field):equals:<value>`  
  Or list recent: `GET .../Deals` with `page`, `per_page`.
- **Get Deal by ID:**  
  `GET https://www.zohoapis.com/crm/v2/Deals/{id}`  
  Use to autofill form when user selects a deal.

**Example Deal response (relevant fields):**

- `Deal_Name`, `Account_Name` (or `Account_Name` from related Account), `id`
- Custom fields: e.g. `Charge_Code`, `Project_Customer` (if you add them in CRM).

**Optional:**

- **Accounts** module for “Project/Customer” if you prefer selecting an Account first, then linking to Deals.

---

## 3. Implementation checklist

### Zoho Books (already done in app)

- [x] Env: `ZOHO_BOOKS_ACCESS_TOKEN`, `ZOHO_BOOKS_ORG_ID`
- [x] API route: `GET /api/zoho/items?sku=`
- [x] Form: BOM ID / Product ID / Component name → lookup → autofill Item name, Rate, Unit
- [x] Optional: refresh token flow for long-lived access (on 401, app refreshes using ZOHO_BOOKS_REFRESH_TOKEN)
- [ ] Optional: create Sales Order / Invoice when ticket is approved (if required)

### Zoho CRM (to implement)

- [ ] Env: `ZOHO_CRM_ACCESS_TOKEN` (and refresh token + client id/secret if using refresh)
- [ ] API route: e.g. `GET /api/zoho/crm/deals?q=<search>` (search/list deals)
- [ ] API route: e.g. `GET /api/zoho/crm/deals/:id` (get one deal for autofill)
- [ ] Form: Project/Customer (or “Link to Deal”) → search deals → on select, autofill:
  - Project/Customer name ← Deal’s Account Name (or custom)
  - Charge code ← Deal custom (or standard) field
  - Deal name ← Deal Name
  - Deal ID ← Deal id
- [ ] Optional: add `deal_id` column to `tickets` if you want to store Zoho Deal ID in DB

---

## 4. Summary table: all fields and sources

| Form section   | Field                 | Zoho Books        | Zoho CRM              | Stored in DB (tickets)   |
|----------------|-----------------------|-------------------|------------------------|--------------------------|
| Request info   | Title                 | —                 | —                      | `title`                  |
|                | Requester name        | —                 | —                      | `requester_name`         |
|                | Department            | —                 | —                      | `department`             |
|                | Team                  | —                 | —                      | `team_name`              |
|                | Priority              | —                 | —                      | `priority`               |
|                | Place of delivery     | —                 | —                      | `place_of_delivery`      |
| Item info      | Component / Item name | Items `name`      | —                      | `item_name`, `component_description` |
|                | BOM ID                | Used as SKU lookup | —                     | `bom_id`                 |
|                | Product ID            | Used as SKU lookup | —                     | `product_id`             |
|                | Cost per item         | Items `rate`      | —                      | `rate`                   |
|                | Unit                  | Items `unit`      | —                      | `unit`                   |
|                | Quantity              | —                 | —                      | `quantity`                |
|                | Estimated cost        | Derived (rate×qty) | —                    | `estimated_cost`         |
|                | Need by date          | —                 | —                      | `need_by_date`           |
| Project info   | Project/Customer name | —                 | Deal → Account/custom  | `project_customer`       |
|                | Charge code           | —                 | Deal custom/standard   | `charge_code`            |
|                | Deal name             | —                 | Deals `Deal_Name`      | `deal_name`              |
|                | Deal ID               | —                 | Deals `id`             | Not in schema yet; add if needed |
|                | Estimated PO date     | —                 | —                      | `estimated_po_date`       |

---

## 5. Next steps in code

1. **Zoho CRM env:** Add to `.env.example`:  
   `ZOHO_CRM_ACCESS_TOKEN`, `ZOHO_CRM_CLIENT_ID`, `ZOHO_CRM_CLIENT_SECRET`, `ZOHO_CRM_REFRESH_TOKEN` (optional).
2. **New API routes:**  
   - `GET /api/zoho/crm/deals?q=<search>` — search/list deals.  
   - `GET /api/zoho/crm/deals/[id]` — get one deal (for autofill).
3. **PurchaseRequestForm:**  
   - Add “Search deal” / “Link to Zoho Deal” (e.g. next to Project/Customer).  
   - On search → call `/api/zoho/crm/deals?q=...`, show list; on select → call `/api/zoho/crm/deals/:id` and set Project/Customer, Charge code, Deal name, Deal ID.
4. **Optional:** Add `deal_id` to `tickets` (migration + API validation) if you want to store the Zoho Deal ID.

If you want, the next step can be implementing the two Zoho CRM API routes and the form wiring (search + autofill).
