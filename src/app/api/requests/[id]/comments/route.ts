import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: ticketId } = await params;
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isRequester = ticket.requesterId === session.user.id;
  const role = session.user.role ?? "";
  const canView =
    role === "SUPER_ADMIN" ||
    isRequester ||
    role === "FUNCTIONAL_HEAD" ||
    role === "L1_APPROVER" ||
    role === "CFO" ||
    role === "CDO" ||
    role === "PRODUCTION";
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const comments = await prisma.comment.findMany({
    where: { ticketId },
    include: { user: { select: { email: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(comments);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: ticketId } = await params;
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isRequester = ticket.requesterId === session.user.id;
  const role = session.user.role ?? "";
  const canComment =
    role === "SUPER_ADMIN" ||
    isRequester ||
    role === "FUNCTIONAL_HEAD" ||
    role === "L1_APPROVER" ||
    role === "CFO" ||
    role === "CDO" ||
    role === "PRODUCTION";
  if (!canComment) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as { body: string };
  if (!body.body?.trim()) {
    return NextResponse.json({ error: "Comment body required" }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: {
      ticketId,
      userId: session.user.id,
      body: body.body.trim(),
    },
    include: { user: { select: { email: true, name: true } } },
  });
  return NextResponse.json(comment);
}
