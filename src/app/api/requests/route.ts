import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { z } from "zod";
import {
  type TeamName,
  type TicketStatus,
  TEAM_NAMES,
  COST_CURRENCIES,
  PRIORITIES,
  getPrimaryRole,
} from "@/types/db";
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
  costCurrency: z.enum(COST_CURRENCIES).optional(),
  estimatedCost: z.number().optional(),
  rate: z.number().optional(),
  unit: z.string().optional(),
  estimatedPODate: z.string().optional(),
  placeOfDelivery: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  dealName: z.string().optional(),
  teamName: z.enum(TEAM_NAMES),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
});

const TICKET_COLS = `id, request_id AS "requestId", title, description, requester_name AS "requesterName", department,
  component_description AS "componentDescription", item_name AS "itemName", bom_id AS "bomId", product_id AS "productId",
  project_customer AS "projectCustomer", need_by_date AS "needByDate", charge_code AS "chargeCode",
  cost_currency AS "costCurrency", estimated_cost AS "estimatedCost", rate, unit, estimated_po_date AS "estimatedPoDate",
  place_of_delivery AS "placeOfDelivery", quantity, deal_name AS "dealName", team_name AS "teamName", priority, status,
  rejection_remarks AS "rejectionRemarks", requester_id AS "requesterId", delivered_at AS "deliveredAt",
  confirmed_at AS "confirmedAt", auto_closed_at AS "autoClosedAt", created_at AS "createdAt", updated_at AS "updatedAt"`;

const TICKET_JOIN_REQ = `SELECT t.id, t.request_id AS "requestId", t.title, t.description, t.requester_name AS "requesterName",
  t.department, t.component_description AS "componentDescription", t.item_name AS "itemName", t.bom_id AS "bomId",
  t.product_id AS "productId", t.project_customer AS "projectCustomer", t.need_by_date AS "needByDate",
  t.charge_code AS "chargeCode", t.cost_currency AS "costCurrency", t.estimated_cost AS "estimatedCost", t.rate, t.unit,
  t.estimated_po_date AS "estimatedPoDate", t.place_of_delivery AS "placeOfDelivery", t.quantity, t.deal_name AS "dealName",
  t.team_name AS "teamName", t.priority, t.status, t.rejection_remarks AS "rejectionRemarks", t.requester_id AS "requesterId",
  t.delivered_at AS "deliveredAt", t.confirmed_at AS "confirmedAt", t.auto_closed_at AS "autoClosedAt",
  t.created_at AS "createdAt", t.updated_at AS "updatedAt",
  u.id AS "rId", u.email AS "rEmail", u.name AS "rName"
  FROM tickets t
  LEFT JOIN users u ON t.requester_id = u.id`;

function mapRowWithRequester(row: Record<string, unknown>) {
  const { rId, rEmail, rName, ...ticket } = row;
  return {
    ...ticket,
    requester: rId != null ? { id: rId, email: rEmail, name: rName } : null,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = getPrimaryRole(session.user.roles);
  const userId = session.user.id;
  const userTeam = session.user.team ?? null;

  if (role === "REQUESTER") {
    const rows = await query<Record<string, unknown>>(
      `SELECT ${TICKET_COLS} FROM tickets WHERE requester_id = $1 ORDER BY updated_at DESC`,
      [userId]
    );
    return NextResponse.json(rows);
  }

  if (role === "SUPER_ADMIN") {
    const rows = await query<Record<string, unknown>>(
      `${TICKET_JOIN_REQ} ORDER BY t.updated_at DESC`
    );
    return NextResponse.json(rows.map(mapRowWithRequester));
  }

  if (role === "FUNCTIONAL_HEAD" && userTeam) {
    const rows = await query<Record<string, unknown>>(
      `${TICKET_JOIN_REQ} WHERE t.status = 'PENDING_FH_APPROVAL' AND t.team_name = $1 ORDER BY t.updated_at DESC`,
      [userTeam]
    );
    return NextResponse.json(rows.map(mapRowWithRequester));
  }

  if (role === "L1_APPROVER" && userTeam) {
    const rows = await query<Record<string, unknown>>(
      `${TICKET_JOIN_REQ} WHERE t.status = 'PENDING_L1_APPROVAL' AND t.team_name = $1 ORDER BY t.updated_at DESC`,
      [userTeam]
    );
    return NextResponse.json(rows.map(mapRowWithRequester));
  }

  const statusMap: Record<string, TicketStatus> = {
    CFO: "PENDING_CFO_APPROVAL",
    CDO: "PENDING_CDO_APPROVAL",
    PRODUCTION: "ASSIGNED_TO_PRODUCTION",
  };
  const status = statusMap[role];
  if (status) {
    const rows = await query<Record<string, unknown>>(
      `${TICKET_JOIN_REQ} WHERE t.status = $1 ORDER BY t.updated_at DESC`,
      [status]
    );
    return NextResponse.json(rows.map(mapRowWithRequester));
  }

  return NextResponse.json([]);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.user.roles?.includes("REQUESTER") && !session.user.roles?.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Only requesters can create tickets" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = { ...parsed.data };
  const needByDate = data.needByDate ? new Date(data.needByDate) : null;
  const estimatedPODate = data.estimatedPODate ? new Date(data.estimatedPODate) : null;
  delete (data as Record<string, unknown>).needByDate;
  delete (data as Record<string, unknown>).estimatedPODate;

  const requestId = await generateRequestId(data.teamName);

  const rows = await query<{ id: string; title: string }>(
    `INSERT INTO tickets (
      title, description, requester_name, department, component_description, item_name, bom_id, product_id,
      project_customer, need_by_date, charge_code, cost_currency, estimated_cost, rate, unit, estimated_po_date,
      place_of_delivery, quantity, deal_name, team_name, priority, status, request_id, requester_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'DRAFT', $22, $23)
    RETURNING id, title`,
    [
      data.title,
      data.description ?? null,
      data.requesterName,
      data.department,
      data.componentDescription ?? null,
      data.itemName ?? null,
      data.bomId ?? null,
      data.productId ?? null,
      data.projectCustomer ?? null,
      needByDate,
      data.chargeCode ?? null,
      data.costCurrency ?? null,
      data.estimatedCost ?? null,
      data.rate ?? null,
      data.unit ?? null,
      estimatedPODate,
      data.placeOfDelivery ?? null,
      data.quantity ?? null,
      data.dealName ?? null,
      data.teamName,
      data.priority ?? "MEDIUM",
      requestId,
      session.user.id,
    ]
  );
  const ticket = rows[0];
  if (!ticket) return NextResponse.json({ error: "Insert failed" }, { status: 500 });

  await logNotification({
    ticketId: ticket.id,
    type: "on_creation",
    recipient: session.user.email ?? "",
    payload: { title: ticket.title },
  });

  const full = await query<Record<string, unknown>>(
    `SELECT ${TICKET_COLS} FROM tickets WHERE id = $1`,
    [ticket.id]
  );
  return NextResponse.json(full[0]);
}
