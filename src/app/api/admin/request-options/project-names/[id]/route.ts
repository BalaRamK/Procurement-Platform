import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";

/** DELETE project/customer option (super admin only) */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.roles?.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  try {
    await query("DELETE FROM project_customer_options WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin project-names DELETE", e);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
