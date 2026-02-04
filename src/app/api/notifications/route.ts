import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/notifications
 * Returns notifications for the current user only (recipient = user email), newest first.
 * RBAC: each user sees only their own notifications.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notifications = await prisma.notification.findMany({
    where: { recipient: session.user.email },
    orderBy: { sentAt: "desc" },
    take: 20,
    include: {
      ticket: {
        select: { id: true, title: true, requestId: true, status: true },
      },
    },
  });

  return NextResponse.json(notifications);
}
