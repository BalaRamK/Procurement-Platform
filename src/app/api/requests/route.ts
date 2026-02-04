import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { TicketStatus, TeamName, CostCurrency, Priority } from "@prisma/client";
import { logNotification } from "@/lib/notifications";
import { generateRequestId } from "@/lib/request-id";

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  requesterName: z.string().min(1),
  department: z.string().min(1),
  componentDescription: z.string().optional(),
  bomId: z.string().optional(),
  productId: z.string().optional(),
  itemName: z.string().optional(),
  projectCustomer: z.string().optional(),
  needByDate: z.string().optional(),
  chargeCode: z.string().optional(),
  costCurrency: z.nativeEnum(CostCurrency).optional(),
  estimatedCost: z.number().optional(),
  rate: z.number().optional(),
  unit: z.string().optional(),
  estimatedPODate: z.string().optional(),
  placeOfDelivery: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  dealName: z.string().optional(),
  teamName: z.nativeEnum(TeamName),
  priority: z.nativeEnum(Priority).default("MEDIUM"),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role ?? "REQUESTER";
  const userId = session.user.id;
  const userTeam = session.user.team ?? null;

  if (role === "REQUESTER") {
    const tickets = await prisma.ticket.findMany({
      where: { requesterId: userId },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(tickets);
  }

  if (role === "SUPER_ADMIN") {
    const tickets = await prisma.ticket.findMany({
      include: { requester: true },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(tickets);
  }

  if (role === "FUNCTIONAL_HEAD" && userTeam) {
    const tickets = await prisma.ticket.findMany({
      where: { status: "PENDING_FH_APPROVAL", teamName: userTeam },
      include: { requester: true },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(tickets);
  }

  if (role === "L1_APPROVER" && userTeam) {
    const tickets = await prisma.ticket.findMany({
      where: { status: "PENDING_L1_APPROVAL", teamName: userTeam },
      include: { requester: true },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(tickets);
  }

  const statusMap: Record<string, TicketStatus> = {
    CFO: "PENDING_CFO_APPROVAL",
    CDO: "PENDING_CDO_APPROVAL",
    PRODUCTION: "ASSIGNED_TO_PRODUCTION",
  };
  const status = statusMap[role];
  if (status) {
    const tickets = await prisma.ticket.findMany({
      where: { status },
      include: { requester: true },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(tickets);
  }

  return NextResponse.json([]);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "REQUESTER" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only requesters can create tickets" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = { ...parsed.data };
  const needByDate = data.needByDate ? new Date(data.needByDate) : undefined;
  const estimatedPODate = data.estimatedPODate ? new Date(data.estimatedPODate) : undefined;
  delete (data as Record<string, unknown>).needByDate;
  delete (data as Record<string, unknown>).estimatedPODate;

  const requestId = await generateRequestId(data.teamName);

  const ticket = await prisma.ticket.create({
    data: {
      ...data,
      requestId,
      needByDate,
      estimatedPODate,
      requesterId: session.user.id,
      status: "DRAFT",
    },
  });

  await logNotification({
    ticketId: ticket.id,
    type: "on_creation",
    recipient: session.user.email ?? "",
    payload: { title: ticket.title },
  });

  return NextResponse.json(ticket);
}
