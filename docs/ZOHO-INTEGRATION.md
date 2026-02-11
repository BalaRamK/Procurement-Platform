# Zoho Books & Zoho CRM Integration — New Request

This guide covers how to integrate **Zoho Books** and **Zoho CRM** with the **New request** flow, and the field mappings between the Procurement Platform and both Zoho products.

---

## 1. Zoho Books integration

### 1.1 What’s already in the app

- **Item lookup by SKU / BOM ID / Product ID**  
  On the New request form, when the user enters a component name or BOM/Product ID and blurs the field, the app calls Zoho Books Items API and autofills:
  - **Item name** (Component Name)
  - **Cost per item** (Rate)
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
   - Use the Zoho OAuth 2.0 flow (authorization code) to get an **Access Token** and optionally **Refresh Token**.
   - Or generate a **self client** token from the API console for testing.
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

### 1.3 Field mapping: Procurement Platform ↔ Zoho Books

| Procurement Platform (New request form) | Zoho Books API / Data        | Direction   | Notes |
|----------------------------------------|-----------------------------|------------|--------|
| **BOM ID** / **Product ID** (search key) | Items API: `sku` query param | Form → API | Lookup by SKU; can use BOM ID or Product ID as SKU in Zoho. |
| **Component Name** / **Item name**     | `items[].name`              | Zoho → Form | Autofill after lookup. |
| **Cost per item** (rate)                | `items[].rate`              | Zoho → Form | Autofill. |
| **Unit**                               | `items[].unit`              | Zoho → Form | e.g. pcs, set, box. |
| **Quantity**                           | Form only                   | —          | User enters; not sent to Zoho in current flow. |
| **Estimated Cost**                      | `rate × quantity` (calculated) | Form only | Not stored in Zoho Items. |

**Zoho Books Items API response (relevant fields):**

- `items[].item_id`, `items[].name`, `items[].sku`, `items[].rate`, `items[].unit`, `items[].description`

**Optional future (not implemented yet):**

- When a ticket is **approved/closed**, create a **Sales Order** or **Invoice** in Zoho Books and map:
  - Ticket `title` → reference
  - `item_name` / `component_description` → line item name
  - `rate`, `quantity`, `unit` → line item
  - `deal_name` / `project_customer` → customer or custom field (if you link Books to CRM).

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
- [ ] Optional: refresh token flow for long-lived access
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
