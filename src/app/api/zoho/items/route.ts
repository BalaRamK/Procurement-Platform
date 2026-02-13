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

  const searchTerm = sku.trim();
  console.log("[Zoho Items] auth OK, search term=" + JSON.stringify(searchTerm));

  // Try old domain first (proxy often allows it); if code 9 then zohoapis (proxy may block zohoapis with 403)
  const listQs = `organization_id=${orgId}`;
  const isIndia = process.env.ZOHO_BOOKS_ACCOUNTS_SERVER?.toLowerCase().includes("zoho.in");
  const baseUrls = isIndia
    ? [
        "https://www.zoho.in/books/api/v3/items",
        "https://books.zoho.in/api/v3/items",
        "https://www.zohoapis.in/books/v3/items",
        "https://www.zohoapis.in/books/api/v3/items",
      ]
    : [
        "https://www.zoho.com/books/api/v3/items",
        "https://books.zoho.com/api/v3/items",
        "https://www.zohoapis.com/books/v3/items",
        "https://www.zohoapis.com/books/api/v3/items",
      ];

  const headers: Record<string, string> = {
    Authorization: "Zoho-oauthtoken " + zohoAccessToken,
    Accept: "application/json",
    "User-Agent": "ProcurementPlatform/1.0 (Zoho Books API)",
  };

  const fetchList = async (accessToken: string): Promise<{ res: Response; text: string }> => {
    headers.Authorization = "Zoho-oauthtoken " + accessToken;
    let lastRes: Response | null = null;
    let lastText = "";
    for (const base of baseUrls) {
      const url = `${base}?${listQs}`;
      try {
        const r = await fetchWithProxy(url, { headers });
        const t = await r.text();
        lastRes = r;
        lastText = t;
        if (r.ok && t.trim().startsWith("{")) return { res: r, text: t };
        if (r.status === 401) continue;
        if (r.status === 400) {
          try {
            const body = JSON.parse(t) as { code?: number };
            if (body.code === 9) continue; // "Use zohoapis domain" -> try next URL
          } catch {
            /* ignore */
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("403") || msg.includes("Proxy CONNECT refused")) {
          console.warn("[Zoho Items] Proxy refused (403) for", new URL(base).hostname, "- try next URL or add zohoapis to NO_PROXY");
        } else {
          throw err;
        }
      }
    }
    return { res: lastRes!, text: lastText };
  };

  let res: { res: Response; text: string };
  try {
    res = await fetchList(zohoAccessToken);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Zoho Items] Request failed:", msg);
    const isTimeout = msg.includes("timed out") || msg.includes("ETIMEDOUT");
    const isProxyRefused = msg.includes("403") || msg.includes("Proxy CONNECT refused");
    if (isTimeout) {
      return NextResponse.json(
        {
          error: "Zoho request timed out",
          code: "ZOHO_TIMEOUT",
          message: "Zoho API did not respond in time. Try again or check network connectivity to zohoapis.in.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        error: isProxyRefused ? "Proxy refused connection to Zoho" : "Zoho request failed",
        code: "ZOHO_NETWORK",
        message: isProxyRefused
          ? "Your proxy returned 403 for Zoho. Try adding zohoapis.in,zohoapis.com,www.zoho.in,books.zoho.in to NO_PROXY, or ask your network team to allow these hosts."
          : msg,
      },
      { status: 502 }
    );
  }
  let text = res.text;

  if (res.res.status === 401) {
    const refreshResult = await refreshZohoBooksToken();
    if (refreshResult.token) {
      const retried = await fetchList(refreshResult.token);
      res = retried;
      text = retried.text;
    } else {
      console.warn("[Zoho Items] 401: Zoho rejected token; refresh failed:", refreshResult.error);
      return NextResponse.json(
        {
          error: refreshResult.error ?? "Zoho Books token expired or invalid",
          code: "ZOHO_AUTH",
          step: "zoho",
          message: refreshResult.hint ?? "Set ZOHO_BOOKS_REFRESH_TOKEN, CLIENT_ID, CLIENT_SECRET or re-run OAuth.",
          hint: refreshResult.hint,
        },
        { status: 401 }
      );
    }
  }

  if (!res.res.ok || !text.trim().startsWith("{")) {
    let code9 = false;
    try {
      const parsed = JSON.parse(text) as { code?: number };
      code9 = parsed.code === 9;
    } catch {
      /* ignore */
    }
    console.warn("[Zoho Items] List items failed, status:", res.res.status, "code9:", code9, "body:", text.slice(0, 200));
    return NextResponse.json(
      {
        error: "Zoho API error",
        code: "ZOHO_AUTH",
        step: "zoho",
        reason: "Could not list items from Zoho Books",
        message: "Zoho API request failed.",
        detail: text.slice(0, 500),
      },
      { status: res.res.status === 401 ? 401 : 502 }
    );
  }

  let data: {
    items?: Array<{
      name?: string;
      sku?: string;
      rate?: number;
      unit?: string;
      description?: string;
      [k: string]: unknown;
    }>;
  };
  try {
    data = JSON.parse(text) as typeof data;
  } catch (e) {
    console.error("[Zoho Items] List JSON parse error:", e);
    return NextResponse.json({ error: "Invalid JSON from Zoho", detail: text.slice(0, 200) }, { status: 502 });
  }

  const items = data.items ?? [];
  const searchLower = searchTerm.toLowerCase();
  const match = items.find(
    (i) =>
      (i.name ?? "").toLowerCase().includes(searchLower) ||
      (i.sku ?? "").toLowerCase().includes(searchLower)
  );

  if (!match) {
    console.log("[Zoho Items] No item matched search in", items.length, "items");
    const body = { found: false } as Record<string, unknown>;
    if (req.nextUrl.searchParams.get("debug") === "1") body._debug = { zohoRaw: data, itemCount: items.length };
    return NextResponse.json(body);
  }

  console.log("[Zoho Items] Data from Zoho: 1 item for search=" + JSON.stringify(searchTerm));
  const payload = {
    found: true,
    name: match.name ?? null,
    rate: match.rate ?? null,
    unit: match.unit ?? null,
    sku: match.sku ?? null,
    description: match.description ?? null,
  } as Record<string, unknown>;
  if (req.nextUrl.searchParams.get("debug") === "1") payload._debug = { zohoRaw: data, source: "list_then_filter" };
  return NextResponse.json(payload);
}
