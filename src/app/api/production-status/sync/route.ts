import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getConnectionInfo } from "@/lib/production-status-auth";
import { getProductionStatusSyncInfo, syncProductionStatusToDb } from "@/lib/production-status-sync";

export const runtime = "nodejs";

async function isAuthorized(req: NextRequest) {
  const cronSecret = process.env.PRODUCTION_STATUS_CRON_SECRET?.trim();
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;
  if (cronSecret && token === cronSecret) return true;
  const session = await getServerSession(authOptions);
  return !!session?.user?.roles?.includes("SUPER_ADMIN");
}

/**
 * POST /api/production-status/sync — pull the Production Status workbook into the database.
 * Run daily from cron. Auth: Bearer PRODUCTION_STATUS_CRON_SECRET, or a signed-in SUPER_ADMIN.
 */
export async function POST(req: NextRequest) {
  if (!(await isAuthorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await syncProductionStatusToDb();
  if (result.ok) return NextResponse.json({ success: true, ...result });
  return NextResponse.json({ success: false, error: result.error }, { status: 500 });
}

/** GET /api/production-status/sync — last sync status (same auth). */
export async function GET(req: NextRequest) {
  if (!(await isAuthorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [sync, connection] = await Promise.all([getProductionStatusSyncInfo(), getConnectionInfo()]);
  return NextResponse.json({ sync: sync ?? { lastStatus: "never run" }, connection: connection ?? "not connected" });
}
