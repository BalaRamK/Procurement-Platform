/**
 * Sync Zoho Books items into the database for fast lookup.
 * Run once manually, then weekly via cron calling POST /api/zoho/sync.
 */

import { query, queryOne } from "@/lib/db";
import { fetchWithProxy } from "@/lib/zoho-fetch";
import { getEffectiveAccessToken, refreshZohoBooksToken } from "@/lib/zoho-refresh";

const PER_PAGE = 200;

type ZohoItemRow = {
  item_id?: string;
  name?: string;
  sku?: string;
  rate?: number;
  unit?: string;
  description?: string;
  purchase_rate?: number;
  purchase_description?: string;
};

/** Same base URL order as items route: try non-zohoapis first, then zohoapis (code 9 = "Use zohoapis domain"). */
function getBaseUrls(): string[] {
  const baseOverride = process.env.ZOHO_BOOKS_API_BASE_URL?.trim();
  if (baseOverride) {
    const base = baseOverride.replace(/\/$/, "");
    return [`${base}/items`, `${base}/items/`];
  }
  const isIndia = process.env.ZOHO_BOOKS_ACCOUNTS_SERVER?.toLowerCase().includes("zoho.in");
  return isIndia
    ? [
        "https://www.zoho.in/books/api/v3/items",
        "https://www.zoho.in/books/api/v3/items/",
        "https://books.zoho.in/api/v3/items",
        "https://books.zoho.in/api/v3/items/",
        "https://www.zohoapis.in/books/api/v3/items",
        "https://www.zohoapis.in/books/api/v3/items/",
        "https://www.zohoapis.in/books/v3/items",
        "https://www.zohoapis.in/books/v3/items/",
      ]
    : [
        "https://www.zoho.com/books/api/v3/items",
        "https://www.zoho.com/books/api/v3/items/",
        "https://books.zoho.com/api/v3/items",
        "https://books.zoho.com/api/v3/items/",
        "https://www.zohoapis.com/books/api/v3/items",
        "https://www.zohoapis.com/books/api/v3/items/",
        "https://www.zohoapis.com/books/v3/items",
        "https://www.zohoapis.com/books/v3/items/",
      ];
}

async function fetchOnePage(
  baseUrl: string,
  orgId: string,
  accessToken: string,
  page: number
): Promise<{ items: ZohoItemRow[]; hasMore: boolean }> {
  const params = new URLSearchParams({
    organization_id: orgId,
    page: String(page),
    per_page: String(PER_PAGE),
  });
  const url = `${baseUrl}?${params.toString()}`;
  const res = await fetchWithProxy(url, {
    headers: {
      Authorization: "Zoho-oauthtoken " + accessToken,
      Accept: "application/json",
      "User-Agent": "ProcurementPlatform/1.0 (Zoho Books Sync)",
    },
  });
  const text = await res.text();
  if (!res.ok) {
    let code: number | undefined;
    try {
      const parsed = JSON.parse(text) as { code?: number };
      code = parsed.code;
    } catch {
      /* ignore */
    }
    if (res.status === 400 && code === 9) throw new Error("ZOHO_TRY_NEXT_URL");
    if ((res.status === 404 || res.status === 400) && code === 5) throw new Error("ZOHO_TRY_NEXT_URL");
    throw new Error(`Zoho API error: ${res.status} ${text.slice(0, 200)}`);
  }
  if (!text.trim().startsWith("{")) throw new Error("ZOHO_TRY_NEXT_URL");
  const data = JSON.parse(text) as {
    items?: ZohoItemRow[];
    page_context?: { has_more_page?: boolean };
  };
  const items = data.items ?? [];
  const hasMore =
    !!data.page_context?.has_more_page || items.length >= PER_PAGE;
  return { items, hasMore };
}

/**
 * Fetches all items from Zoho Books (paginated) and upserts into zoho_books_items.
 * Returns { ok, syncedCount, error }.
 */
export async function syncZohoBooksItemsToDb(): Promise<{
  ok: boolean;
  syncedCount?: number;
  error?: string;
}> {
  const orgId = process.env.ZOHO_BOOKS_ORG_ID?.trim();
  if (!orgId) {
    return { ok: false, error: "ZOHO_BOOKS_ORG_ID is not set" };
  }

  let accessToken =
    getEffectiveAccessToken() ?? process.env.ZOHO_BOOKS_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    return { ok: false, error: "Zoho Books access token not configured" };
  }

  const baseUrls = getBaseUrls();
  let workingBase = "";
  for (const base of baseUrls) {
    try {
      const { items } = await fetchOnePage(base, orgId, accessToken, 1);
      workingBase = base;
      break;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("ZOHO_TRY_NEXT_URL")) continue;
      if (msg.includes("401")) {
        const refresh = await refreshZohoBooksToken();
        if (refresh.token) {
          accessToken = refresh.token;
          try {
            const retry = await fetchOnePage(base, orgId, accessToken, 1);
            workingBase = base;
            break;
          } catch (retryErr) {
            const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
            if (retryMsg.includes("ZOHO_TRY_NEXT_URL")) continue;
            throw retryErr;
          }
        }
      }
      throw e;
    }
  }

  if (!workingBase) {
    return { ok: false, error: "Could not connect to Zoho Books API (tried all base URLs)" };
  }

  let page = 1;
  let totalSynced = 0;
  let hasMore = true;

  while (hasMore) {
    let items: ZohoItemRow[];
    try {
      const result = await fetchOnePage(workingBase, orgId, accessToken, page);
      items = result.items;
      hasMore = result.hasMore;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("401")) {
        const refresh = await refreshZohoBooksToken();
        if (refresh.token) {
          accessToken = refresh.token;
          const result = await fetchOnePage(workingBase, orgId, accessToken, page);
          items = result.items;
          hasMore = result.hasMore;
        } else {
          return { ok: false, error: "Zoho token expired and refresh failed", syncedCount: totalSynced };
        }
      } else {
        return { ok: false, error: msg, syncedCount: totalSynced };
      }
    }

    for (const item of items) {
      const id = item.item_id;
      if (!id) continue;
      await query(
        `INSERT INTO zoho_books_items (id, name, sku, rate, unit, description, purchase_rate, purchase_description, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           sku = EXCLUDED.sku,
           rate = EXCLUDED.rate,
           unit = EXCLUDED.unit,
           description = EXCLUDED.description,
           purchase_rate = EXCLUDED.purchase_rate,
           purchase_description = EXCLUDED.purchase_description,
           synced_at = now()`,
        [
          id,
          item.name ?? null,
          item.sku ?? null,
          item.rate ?? null,
          item.unit ?? null,
          item.description ?? null,
          item.purchase_rate ?? null,
          item.purchase_description ?? null,
        ]
      );
      totalSynced++;
    }

    if (items.length < PER_PAGE) hasMore = false;
    else page++;
  }

  return { ok: true, syncedCount: totalSynced };
}

/** Returns one item from DB by sku or name match (for lookup). */
export async function getZohoItemFromDb(
  searchTerm: string
): Promise<{
  id: string;
  name: string | null;
  sku: string | null;
  rate: number | null;
  unit: string | null;
  description: string | null;
  purchase_rate: number | null;
  purchase_description: string | null;
} | null> {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return null;
  const row = await queryOne<{
    id: string;
    name: string | null;
    sku: string | null;
    rate: number | null;
    unit: string | null;
    description: string | null;
    purchase_rate: number | null;
    purchase_description: string | null;
  }>(
    `SELECT id, name, sku, rate, unit, description, purchase_rate, purchase_description
     FROM zoho_books_items
     WHERE LOWER(COALESCE(sku, '')) = $1 OR LOWER(COALESCE(name, '')) LIKE $2
     LIMIT 1`,
    [term, "%" + term + "%"]
  );
  return row;
}

/** Search zoho_books_items by name or SKU (partial match); returns up to 20 items for autocomplete. */
export async function searchZohoItemsFromDb(
  searchTerm: string,
  limit = 20
): Promise<
  Array<{
    id: string;
    name: string | null;
    sku: string | null;
    rate: number | null;
    unit: string | null;
  }>
> {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return [];
  const rows = await query<
    { id: string; name: string | null; sku: string | null; rate: number | null; unit: string | null }
  >(
    `SELECT id, name, sku, rate, unit
     FROM zoho_books_items
     WHERE LOWER(COALESCE(name, '')) LIKE $1 OR LOWER(COALESCE(sku, '')) LIKE $1
     ORDER BY name
     LIMIT $2`,
    ["%" + term + "%", limit]
  );
  return rows;
}
