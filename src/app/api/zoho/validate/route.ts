import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchWithProxy } from "@/lib/zoho-fetch";

/**
 * GET /api/zoho/validate
 * Validates Zoho Books credentials (access token + org ID) by calling the Zoho Books API.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = process.env.ZOHO_BOOKS_ACCESS_TOKEN;
    const orgId = process.env.ZOHO_BOOKS_ORG_ID;

    if (!token?.trim()) {
      return NextResponse.json(
        { valid: false, error: "ZOHO_BOOKS_ACCESS_TOKEN is not set or empty" },
        { status: 200 }
      );
    }

    if (!orgId?.trim()) {
      return NextResponse.json(
        { valid: false, error: "ZOHO_BOOKS_ORG_ID is not set or empty" },
        { status: 200 }
      );
    }

    const headers: Record<string, string> = {
      Authorization: "Zoho-oauthtoken " + token.trim(),
      Accept: "application/json",
      "User-Agent": "ProcurementPlatform/1.0 (Zoho Books API)",
    };
    const urlsToTry = [
      "https://www.zoho.com/books/api/v3/organizations",
      "https://www.zoho.com/books/api/v3/organizations/",
      "https://www.zoho.in/books/api/v3/organizations",
      "https://www.zoho.in/books/api/v3/organizations/",
      "https://books.zoho.com/api/v3/organizations",
      "https://books.zoho.in/api/v3/organizations",
    ];

    let res: Response | null = null;
    let text = "";
    for (const url of urlsToTry) {
      res = await fetchWithProxy(url, { headers });
      text = await res.text();
      if (res.ok && text.trim().startsWith("{")) break;
    }
    if (!res) {
      return NextResponse.json(
        { valid: false, error: "No response from Zoho" },
        { status: 200 }
      );
    }

    if (!res.ok) {
      let message = "Zoho API request failed";
      if (res.status === 401) {
        message = "Access token is invalid or expired";
      } else if (res.status === 403) {
        message = "Access denied (check token scopes or organization access)";
      } else {
        message = text || `HTTP ${res.status}`;
      }
      return NextResponse.json(
        { valid: false, error: message, status: res.status },
        { status: 200 }
      );
    }

    let data: { organizations?: Array<{ organization_id: string; name?: string }> };
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      const snippet = text.trim().slice(0, 300).replace(/\s+/g, " ");
      return NextResponse.json({
        valid: false,
        error: "Zoho returned HTML or non-JSON (check region URL or proxy). Try the India API if your org is in India.",
        detail: snippet || `Response length: ${text.length}`,
      });
    }

    const organizations = data.organizations ?? [];
    const matched = organizations.find(
      (org) => String(org.organization_id) === String(orgId.trim())
    );

    if (!matched) {
      return NextResponse.json({
        valid: false,
        error: `Organization ID "${orgId}" not found. Your token has access to: ${organizations.map((o) => o.organization_id).join(", ") || "none"}`,
        organizations: organizations.map((o) => ({
          organization_id: o.organization_id,
          name: o.name,
        })),
      });
    }

    return NextResponse.json({
      valid: true,
      message: "Zoho Books credentials are valid",
      organization: { organization_id: matched.organization_id, name: matched.name },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { valid: false, error: "Request failed", detail: message },
      { status: 500 }
    );
  }
}
