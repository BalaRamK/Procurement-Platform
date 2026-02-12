import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized", code: "SESSION_REQUIRED", message: "Please sign in to use Zoho lookup." },
      { status: 401 }
    );
  }

  const sku = req.nextUrl.searchParams.get("sku");
  if (!sku?.trim()) {
    return NextResponse.json({ error: "Missing sku" }, { status: 400 });
  }

  let token = getEffectiveAccessToken() ?? process.env.ZOHO_BOOKS_ACCESS_TOKEN?.trim();
  const orgId = process.env.ZOHO_BOOKS_ORG_ID?.trim();
  if (!token || !orgId) {
    return NextResponse.json(
      { error: "Zoho Books not configured" },
      { status: 503 }
    );
  }

  const skuEnc = encodeURIComponent(sku.trim());
  const qs = `organization_id=${orgId}&sku=${skuEnc}`;
  const baseUrls = [
    "https://www.zoho.com/books/api/v3/items",
    "https://www.zoho.in/books/api/v3/items",
    "https://books.zoho.com/api/v3/items",
    "https://books.zoho.in/api/v3/items",
  ];

  const headers: Record<string, string> = {
    Authorization: "Zoho-oauthtoken " + token,
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
      if (r.status === 401) return { res: r, text: t };
    }
    return { res: lastRes!, text: lastText };
  };

  let res = await fetchWithProxy(baseUrls[0] + "?" + qs, { headers });
  let text = await res.text();
  if (!res.ok || !text.trim().startsWith("{")) {
    const result = await tryUrls(token);
    res = result.res;
    text = result.text;
  }

  if (res.status === 401) {
    const newToken = await refreshZohoBooksToken();
    if (newToken) {
      const result = await tryUrls(newToken);
      res = result.res;
      text = result.text;
    }
  }

  if (!res.ok) {
    return NextResponse.json(
      {
        error: "Zoho API error",
        code: "ZOHO_AUTH",
        message: res.status === 401 ? "Zoho Books token expired or invalid. Refresh the token or re-run the OAuth flow." : "Zoho API request failed.",
        detail: text.slice(0, 500),
      },
      { status: res.status }
    );
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
