import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { fetchWithProxy } from "@/lib/zoho-fetch";
import { getEffectiveAccessToken, refreshZohoBooksToken } from "@/lib/zoho-refresh";

/**
 * GET /api/zoho/validate
 * Validates Zoho Books credentials (access token + org ID) by calling the Zoho Books API.
 */
export async function GET(req: NextRequest) {
  try {
    const authToken = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!authToken?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let zohoAccessToken = getEffectiveAccessToken() ?? process.env.ZOHO_BOOKS_ACCESS_TOKEN?.trim();
    const orgId = process.env.ZOHO_BOOKS_ORG_ID?.trim();

    if (!zohoAccessToken) {
      return NextResponse.json(
        { valid: false, error: "ZOHO_BOOKS_ACCESS_TOKEN is not set or empty" },
        { status: 200 }
      );
    }

    if (!orgId) {
      return NextResponse.json(
        { valid: false, error: "ZOHO_BOOKS_ORG_ID is not set or empty" },
        { status: 200 }
      );
    }

    const isIndia = process.env.ZOHO_BOOKS_ACCOUNTS_SERVER?.toLowerCase().includes("zoho.in");
    // Old domain first; zohoapis returns 404 in some setups, so try /books/v3/ and /books/api/v3/ as fallbacks
    const urlsToTry = isIndia
      ? [
          "https://www.zoho.in/books/api/v3/organizations",
          "https://books.zoho.in/api/v3/organizations",
          "https://www.zohoapis.in/books/v3/organizations",
          "https://www.zohoapis.in/books/api/v3/organizations",
        ]
      : [
          "https://www.zoho.com/books/api/v3/organizations",
          "https://books.zoho.com/api/v3/organizations",
          "https://www.zohoapis.com/books/v3/organizations",
          "https://www.zohoapis.com/books/api/v3/organizations",
        ];

    const makeRequest = async (accessToken: string) => {
      const headers: Record<string, string> = {
        Authorization: "Zoho-oauthtoken " + accessToken,
        Accept: "application/json",
        "User-Agent": "ProcurementPlatform/1.0 (Zoho Books API)",
      };
      let res: Response | null = null;
      let text = "";
      for (const url of urlsToTry) {
        res = await fetchWithProxy(url, { headers });
        text = await res.text();
        if (res.ok && text.trim().startsWith("{")) break;
      }
      return { res, text };
    };

    let { res, text } = await makeRequest(zohoAccessToken);
    if (res?.status === 401) {
      const refreshResult = await refreshZohoBooksToken();
      if (refreshResult.token) {
        const retried = await makeRequest(refreshResult.token);
        res = retried.res;
        text = retried.text;
      } else {
        return NextResponse.json(
          {
            valid: false,
            error: refreshResult.error ?? "Access token is invalid or expired (refresh failed or not configured)",
            hint: refreshResult.hint,
            status: 401,
          },
          { status: 200 }
        );
      }
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
        message = "Access token is invalid or expired (refresh failed or not configured)";
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
