import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncZohoBooksItemsToDb } from "@/lib/zoho-sync";

/**
 * POST /api/zoho/sync — Sync all Zoho Books items into the database.
 * Call once to seed, then weekly via cron.
 *
 * Auth: (1) Bearer token matching ZOHO_SYNC_CRON_SECRET, or
 *       (2) signed-in user with SUPER_ADMIN role.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.ZOHO_SYNC_CRON_SECRET?.trim();
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : req.nextUrl.searchParams.get("secret")?.trim();

  if (cronSecret && token === cronSecret) {
    const result = await syncZohoBooksItemsToDb();
    if (result.ok) {
      return NextResponse.json({
        success: true,
        message: "Zoho Books items synced",
        syncedCount: result.syncedCount,
      });
    }
    return NextResponse.json(
      { success: false, error: result.error, syncedCount: result.syncedCount },
      { status: 500 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncZohoBooksItemsToDb();
  if (result.ok) {
    return NextResponse.json({
      success: true,
      message: "Zoho Books items synced",
      syncedCount: result.syncedCount,
    });
  }
  return NextResponse.json(
    { success: false, error: result.error, syncedCount: result.syncedCount },
    { status: 500 }
  );
}
