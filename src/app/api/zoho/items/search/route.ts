import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { searchZohoItemsFromDb } from "@/lib/zoho-sync";

/**
 * GET /api/zoho/items/search?q=... — Returns matching items from synced Zoho DB for autocomplete.
 * Requires auth. Query param q (min 1 char) triggers search by name/sku (partial, case-insensitive).
 */
export async function GET(req: NextRequest) {
  const authToken = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });
  if (!authToken?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 20, 50);
  const items = await searchZohoItemsFromDb(q, limit);
  return NextResponse.json({ items });
}
