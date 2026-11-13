import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectWithAuthCode } from "@/lib/production-status-auth";

export const runtime = "nodejs";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function page(message: string, status = 200) {
  const res = new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>Production Status connection</title></head>` +
      `<body style="font-family:Arial,sans-serif;max-width:560px;margin:60px auto;padding:0 16px;"><h2>Production Status connection</h2>` +
      `<p>${escapeHtml(message)}</p></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
  res.cookies.delete({ name: "ps_oauth_state", path: "/api/production-status" });
  return res;
}

/** GET /api/production-status/callback — Microsoft redirects here after the workbook owner signs in. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.roles?.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const error = params.get("error");
  if (error) return page(`Microsoft returned an error: ${params.get("error_description") ?? error}`, 400);

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || state !== req.cookies.get("ps_oauth_state")?.value) {
    return page("The sign-in could not be verified. Start again from /api/production-status/connect.", 400);
  }

  try {
    const account = await connectWithAuthCode(code, session.user.email);
    return page(`Connected${account ? ` as ${account}` : ""}. The daily sync can now read the workbook. You can close this tab.`);
  } catch (e) {
    console.error("[production-status connect]", e);
    return page(e instanceof Error ? e.message : "Connection failed.", 500);
  }
}
