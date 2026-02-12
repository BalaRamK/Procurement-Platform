import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchWithProxy } from "@/lib/zoho-fetch";
import { getEffectiveAccessToken, refreshZohoBooksToken } from "@/lib/zoho-refresh";

export type ZohoItemResponse = {
  name?: string;
  rate?: number;
  unit?: string;
  sku?: string;
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const url = `https://www.zoho.com/books/api/v3/items?organization_id=${orgId}&sku=${encodeURIComponent(sku.trim())}`;
  let res = await fetchWithProxy(url, {
    headers: {
      Authorization: "Zoho-oauthtoken " + token,
      Accept: "application/json",
    },
  });

  if (res.status === 401) {
    const newToken = await refreshZohoBooksToken();
    if (newToken) {
      res = await fetchWithProxy(url, {
        headers: {
          Authorization: "Zoho-oauthtoken " + newToken,
          Accept: "application/json",
        },
      });
    }
  }

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: "Zoho API error", detail: text },
      { status: res.status }
    );
  }

  const data = (await res.json()) as {
    items?: Array<{
      name?: string;
      rate?: number;
      unit?: string;
      sku?: string;
    }>;
  };

  const items = data.items ?? [];
  const item = items[0];
  if (!item) {
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({
    found: true,
    name: item.name ?? null,
    rate: item.rate ?? null,
    unit: item.unit ?? null,
    sku: item.sku ?? null,
  });
}
