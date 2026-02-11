import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * GET /api/zoho/validate
 * Validates Zoho Books credentials (access token + org ID) by calling the Zoho Books API.
 */
export async function GET() {
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

  const url = "https://www.zoho.com/books/api/v3/organizations";
  const res = await fetch(url, {
    headers: { Authorization: "Zoho-oauthtoken " + token.trim() },
  });

  if (!res.ok) {
    const text = await res.text();
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

  const data = (await res.json()) as {
    organizations?: Array<{ organization_id: string; name?: string }>;
  };
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
}
