import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { logApproval } from "@/lib/audit";
import { logNotification } from "@/lib/notifications";
import { sendNotificationEmail } from "@/lib/email";
import { TicketStatus, TeamName } from "@prisma/client";

function canView(
  role: string | null,
  userTeam: TeamName | null,
  ticket: { requesterId: string; status: TicketStatus; teamName: TeamName }
) {
  if (role === "SUPER_ADMIN") return true;
  if (ticket.requesterId && role === "REQUESTER") return true;
  if (role === "PRODUCTION" && ticket.status === "ASSIGNED_TO_PRODUCTION") return true;
  if (role === "PRODUCTION" && ticket.status === "DELIVERED_TO_REQUESTER") return true;
  if (role === "FUNCTIONAL_HEAD" && userTeam && ticket.teamName === userTeam && ticket.status === "PENDING_FH_APPROVAL") return true;
  if (role === "L1_APPROVER" && userTeam && ticket.teamName === userTeam && ticket.status === "PENDING_L1_APPROVAL") return true;
  if (role === "CFO" && ticket.status === "PENDING_CFO_APPROVAL") return true;
  if (role === "CDO" && ticket.status === "PENDING_CDO_APPROVAL") return true;
  return false;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { requester: true },
  });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = session.user.role ?? "REQUESTER";
  const userTeam = session.user.team ?? null;
  const isRequester = ticket.requesterId === session.user.id;
  if (!canView(role, userTeam, ticket) && !isRequester) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(ticket);
}

type ApprovalBody = { action: "approved" | "rejected" | "submit" | "mark_delivered" | "confirm_receipt"; remarks?: string };

const nextStatusOnApproval: Partial<Record<TicketStatus, TicketStatus>> = {
  PENDING_FH_APPROVAL: "PENDING_L1_APPROVAL",
  PENDING_L1_APPROVAL: "PENDING_CFO_APPROVAL",
  PENDING_CFO_APPROVAL: "PENDING_CDO_APPROVAL",
  PENDING_CDO_APPROVAL: "ASSIGNED_TO_PRODUCTION",
};

const roleAndTeamForStatus: Record<TicketStatus, { role: string; teamRequired: boolean } | null> = {
  PENDING_FH_APPROVAL: { role: "FUNCTIONAL_HEAD", teamRequired: true },
  PENDING_L1_APPROVAL: { role: "L1_APPROVER", teamRequired: true },
  PENDING_CFO_APPROVAL: { role: "CFO", teamRequired: false },
  PENDING_CDO_APPROVAL: { role: "CDO", teamRequired: false },
  DRAFT: null,
  ASSIGNED_TO_PRODUCTION: null,
  DELIVERED_TO_REQUESTER: null,
  CONFIRMED_BY_REQUESTER: null,
  CLOSED: null,
  REJECTED: null,
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as ApprovalBody;
  const role = session.user.role ?? "";
  const userTeam = session.user.team ?? null;

  if (body.action === "submit") {
    if (ticket.status !== "DRAFT") {
      return NextResponse.json({ error: "Only draft tickets can be submitted" }, { status: 400 });
    }
    if (ticket.requesterId !== session.user.id) {
      return NextResponse.json({ error: "Only the requester can submit" }, { status: 403 });
    }
    const initialStatus: TicketStatus =
      ticket.teamName === "SALES" ? "PENDING_L1_APPROVAL" : "PENDING_FH_APPROVAL";
    await prisma.ticket.update({
      where: { id },
      data: { status: initialStatus },
    });
    await logNotification({
      ticketId: id,
      type: "assignment",
      recipient: "agent",
      payload: { status: initialStatus },
    });
    return NextResponse.json({ ok: true, status: initialStatus });
  }

  if (body.action === "mark_delivered") {
    if (ticket.status !== "ASSIGNED_TO_PRODUCTION" || role !== "PRODUCTION") {
      return NextResponse.json({ error: "Only Production can mark as delivered" }, { status: 403 });
    }
    await prisma.ticket.update({
      where: { id },
      data: { status: "DELIVERED_TO_REQUESTER", deliveredAt: new Date() },
    });
    const t = await prisma.ticket.findUnique({ where: { id }, include: { requester: true } });
    if (t?.requester.email) {
      await logNotification({
        ticketId: id,
        type: "delivered",
        recipient: t.requester.email,
        payload: { title: t.title },
      });
    }
    return NextResponse.json({ ok: true, status: "DELIVERED_TO_REQUESTER" });
  }

  if (body.action === "confirm_receipt") {
    if (ticket.status !== "DELIVERED_TO_REQUESTER" || ticket.requesterId !== session.user.id) {
      return NextResponse.json({ error: "Only the requester can confirm receipt" }, { status: 403 });
    }
    await prisma.ticket.update({
      where: { id },
      data: { status: "CONFIRMED_BY_REQUESTER", confirmedAt: new Date() },
    });
    await prisma.ticket.update({
      where: { id },
      data: { status: "CLOSED" },
    });
    await logNotification({
      ticketId: id,
      type: "closure",
      recipient: session.user.email,
      payload: { title: ticket.title },
    });
    return NextResponse.json({ ok: true, status: "CLOSED" });
  }

  const allowed = roleAndTeamForStatus[ticket.status];
  if (!allowed || allowed.role !== role) {
    return NextResponse.json({ error: "Not your stage to approve" }, { status: 403 });
  }
  if (allowed.teamRequired && userTeam !== ticket.teamName) {
    return NextResponse.json({ error: "Ticket is not for your team" }, { status: 403 });
  }
  if (body.action !== "approved" && body.action !== "rejected") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  if (body.action === "rejected" && !(body.remarks?.trim())) {
    return NextResponse.json({ error: "Rejection remarks are mandatory" }, { status: 400 });
  }

  await logApproval({
    ticketId: id,
    userEmail: session.user.email,
    userId: session.user.id,
    action: body.action,
    remarks: body.remarks ?? undefined,
  });

  if (body.action === "rejected") {
    await prisma.ticket.update({
      where: { id },
      data: { status: "REJECTED", rejectionRemarks: body.remarks ?? undefined },
    });
    const requester = await prisma.user.findUnique({
      where: { id: ticket.requesterId },
      select: { email: true },
    });
    if (requester?.email) {
      sendNotificationEmail("request_rejected", requester.email, id, {
        rejectionRemarks: body.remarks ?? "",
      }).catch((e) => console.error("[rejection email]", e));
    }
    return NextResponse.json({ ok: true, status: "REJECTED" });
  }

  const nextStatus = nextStatusOnApproval[ticket.status];
  if (!nextStatus) return NextResponse.json({ ok: true, status: ticket.status });

  await prisma.ticket.update({
    where: { id },
    data: { status: nextStatus },
  });

  if (nextStatus === "ASSIGNED_TO_PRODUCTION") {
    await logNotification({
      ticketId: id,
      type: "team_assignment",
      recipient: "production_team",
      payload: { title: ticket.title },
    });
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}
