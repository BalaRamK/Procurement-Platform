import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { fetchWithProxy } from "@/lib/zoho-fetch";
import { getEffectiveAccessToken, refreshZohoBooksToken } from "@/lib/zoho-refresh";

/** Response shape for Zoho Books → Platform (lookup only). All fields come from Zoho Books. */
export type ZohoItemResponse = {
  name?: string;
  rate?: number;
  unit?: string;
  sku?: string;
  description?: string;
};

export async function GET(req: NextRequest) {
  // Use getToken with the request so cookies from this API request are used (getServerSession can miss context in Route Handlers).
  const authToken = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!authToken?.email) {
    console.warn("[Zoho Items] 401: no session (not signed in or cookies not sent)");
    const body: Record<string, unknown> = {
      error: "Unauthorized",
      code: "SESSION_REQUIRED",
      step: "auth",
      reason: "Not signed in or session not sent with request",
      message: "Please sign in to use Zoho lookup.",
    };
    if (req.nextUrl.searchParams.get("debug") === "1") body._debug = { step: "auth", zohoCalled: false };
    return NextResponse.json(body, { status: 401 });
  }

  const sku = req.nextUrl.searchParams.get("sku");
  if (!sku?.trim()) {
    return NextResponse.json({ error: "Missing sku" }, { status: 400 });
  }

  let zohoAccessToken = getEffectiveAccessToken() ?? process.env.ZOHO_BOOKS_ACCESS_TOKEN?.trim();
  const orgId = process.env.ZOHO_BOOKS_ORG_ID?.trim();
  if (!zohoAccessToken || !orgId) {
    return NextResponse.json(
      { error: "Zoho Books not configured" },
      { status: 503 }
    );
  }

  const skuTrimmed = sku.trim();
  console.log("[Zoho Items] auth OK, calling Zoho Books API for sku=" + JSON.stringify(skuTrimmed));

  const skuEnc = encodeURIComponent(skuTrimmed);
  const qs = `organization_id=${orgId}&sku=${skuEnc}`;
  // Zoho requires zohoapis domain for API requests (code 9); India uses zohoapis.in
  const isIndia = process.env.ZOHO_BOOKS_ACCOUNTS_SERVER?.toLowerCase().includes("zoho.in");
  const baseUrls = isIndia
    ? [
        "https://www.zohoapis.in/books/api/v3/items",
        "https://www.zoho.in/books/api/v3/items",
        "https://books.zoho.in/api/v3/items",
      ]
    : [
        "https://www.zohoapis.com/books/api/v3/items",
        "https://www.zoho.com/books/api/v3/items",
        "https://books.zoho.com/api/v3/items",
      ];

  const headers: Record<string, string> = {
    Authorization: "Zoho-oauthtoken " + zohoAccessToken,
    Accept: "application/json",
    "User-Agent": "ProcurementPlatform/1.0 (Zoho Books API)",
  };

  const tryUrls = async (accessToken: string): Promise<{ res: Response; text: string }> => {
    headers.Authorization = "Zoho-oauthtoken " + accessToken;
    let lastRes: Response | null = null;
    let lastText = "";
    for (const base of baseUrls) {
      const url = `${base}?${qs}`;
      const r = await fetchWithProxy(url, { headers });
      const t = await r.text();
      lastRes = r;
      lastText = t;
      if (r.ok && t.trim().startsWith("{")) return { res: r, text: t };
      // Don't stop on 401: India-issued tokens are rejected by .com URLs; try .in next
      if (r.status === 401) continue;
    }
    return { res: lastRes!, text: lastText };
  };

  let res = await fetchWithProxy(baseUrls[0] + "?" + qs, { headers });
  let text = await res.text();
  if (!res.ok || !text.trim().startsWith("{")) {
    const result = await tryUrls(zohoAccessToken);
    res = result.res;
    text = result.text;
  }

  if (res.status === 401) {
    const refreshResult = await refreshZohoBooksToken();
    if (refreshResult.token) {
      const result = await tryUrls(refreshResult.token);
      res = result.res;
      text = result.text;
    } else {
      console.warn("[Zoho Items] 401: Zoho rejected token; refresh failed:", refreshResult.error);
      const body: Record<string, unknown> = {
        error: refreshResult.error ?? "Zoho Books token expired or invalid",
        code: "ZOHO_AUTH",
        step: "zoho",
        reason: "Zoho API returned 401; token refresh failed or not configured",
        message: refreshResult.hint ?? "Set ZOHO_BOOKS_REFRESH_TOKEN, CLIENT_ID, CLIENT_SECRET or re-run OAuth to get a new token.",
        hint: refreshResult.hint,
      };
      if (req.nextUrl.searchParams.get("debug") === "1") body._debug = { step: "zoho", zohoCalled: true, refreshFailed: true };
      return NextResponse.json(body, { status: 401 });
    }
  }

  if (!res.ok) {
    console.warn("[Zoho Items] Zoho returned status", res.status, "body:", text.slice(0, 400));
    if (res.status === 400) {
      // Some Zoho Books setups don't accept sku filter; list items without filter and search in-memory
      // Use same baseUrls (zohoapis first) so we don't get code 9 or doc-page HTML
      const listBases = baseUrls;
      const listQs = `organization_id=${orgId}`;
      let listRes: Response | null = null;
      let listText = "";
      console.log("[Zoho Items] 400 fallback: listing items (no sku filter), try:", listBases.map((u) => new URL(u).hostname).join(", "));
      for (const base of listBases) {
        const listUrl = `${base}?${listQs}`;
        const r = await fetchWithProxy(listUrl, { headers });
        const t = await r.text();
        const isJson = t.trim().startsWith("{");
        const isHtml = t.trim().startsWith("<");
        console.log("[Zoho Items] Fallback list", new URL(base).hostname, "status:", r.status, "json:", isJson, "html:", isHtml);
        if (r.ok && isJson) {
          listRes = r;
          listText = t;
          break;
        }
        // Only remember non-HTML responses (401, 400, etc.) so we don't report doc page as "last"
        if (!r.ok || !isHtml) {
          listRes = r;
          listText = t;
        }
      }
      if (listRes?.ok && listText.trim().startsWith("{")) {
        try {
          const listData = JSON.parse(listText) as {
            items?: Array<{ name?: string; sku?: string; rate?: number; unit?: string; description?: string; [k: string]: unknown }>;
            page_context?: { has_more_page?: boolean };
          };
          const items = listData.items ?? [];
          const searchLower = skuTrimmed.toLowerCase();
          const match = items.find(
            (i) =>
              (i.name ?? "").toLowerCase().includes(searchLower) ||
              (i.sku ?? "").toLowerCase().includes(searchLower)
          );
          if (match) {
            const item = match;
            console.log("[Zoho Items] Data from Zoho (fallback list+filter): 1 item for search=" + JSON.stringify(skuTrimmed));
            const payload = {
              found: true,
              name: item.name ?? null,
              rate: item.rate ?? null,
              unit: item.unit ?? null,
              sku: item.sku ?? null,
              description: item.description ?? null,
            } as Record<string, unknown>;
            if (req.nextUrl.searchParams.get("debug") === "1") payload._debug = { zohoRaw: listData, source: "list_then_filter" };
            return NextResponse.json(payload);
          }
          console.log("[Zoho Items] Fallback: no item matched search in", items.length, "items");
        } catch (e) {
          console.warn("[Zoho Items] Fallback list parse error:", e);
        }
      } else {
        console.warn("[Zoho Items] Fallback list failed, last status:", listRes?.status, "body:", listText?.slice(0, 200));
      }
    }
    const body: Record<string, unknown> = {
      error: "Zoho API error",
      code: res.status === 400 ? "ZOHO_BAD_REQUEST" : "ZOHO_AUTH",
      step: "zoho",
      reason: res.status === 401 ? "Zoho rejected the request (token or org)" : res.status === 400 ? "Zoho rejected the request (check 'detail' for their message)" : "Zoho API request failed",
      message: res.status === 401 ? "Zoho Books token expired or invalid. Refresh the token or re-run the OAuth flow." : "Zoho API request failed.",
      detail: text.slice(0, 500),
    };
    if (req.nextUrl.searchParams.get("debug") === "1") body._debug = { step: "zoho", zohoCalled: true, zohoStatus: res.status };
    return NextResponse.json(body, { status: res.status });
  }

  // Zoho sometimes returns HTML (error page, redirect, doc page) with 200 – don't parse as JSON
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    console.error("[Zoho Items] Zoho returned non-JSON (status " + res.status + "). Body snippet:", text.slice(0, 300));
    return NextResponse.json(
      {
        error: "Zoho returned non-JSON (possibly an error or login page)",
        detail: trimmed.slice(0, 300),
      },
      { status: 502 }
    );
  }

  let data: {
    items?: Array<{
      name?: string;
      rate?: number;
      unit?: string;
      sku?: string;
      description?: string;
      [k: string]: unknown;
    }>;
    [k: string]: unknown;
  };
  try {
    data = JSON.parse(text) as typeof data;
  } catch (e) {
    console.error("[Zoho Items] JSON parse error:", e);
    return NextResponse.json(
      { error: "Invalid JSON from Zoho", detail: text.slice(0, 200) },
      { status: 502 }
    );
  }

  // Log what Zoho actually returned (for debugging)
  console.log("[Zoho Items] raw response keys:", Object.keys(data));
  console.log("[Zoho Items] items count:", data.items?.length ?? 0);
  if (data.items?.[0]) {
    console.log("[Zoho Items] first item keys:", Object.keys(data.items[0]));
    console.log("[Zoho Items] first item:", JSON.stringify(data.items[0]));
  }

  const items = data.items ?? [];
  const item = items[0];
  console.log("[Zoho Items] Data from Zoho: " + (items.length ? `${items.length} item(s) for sku=${skuTrimmed}` : `0 items for sku=${skuTrimmed}`));
  if (!item) {
    const body = { found: false } as Record<string, unknown>;
    if (req.nextUrl.searchParams.get("debug") === "1") body._debug = { zohoRaw: data };
    return NextResponse.json(body);
  }

  const payload = {
    found: true,
    name: item.name ?? null,
    rate: item.rate ?? null,
    unit: item.unit ?? null,
    sku: item.sku ?? null,
    description: item.description ?? null,
  } as Record<string, unknown>;
  if (req.nextUrl.searchParams.get("debug") === "1") payload._debug = { zohoRaw: data };
  return NextResponse.json(payload);
}
