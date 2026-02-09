import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { logApproval } from "@/lib/audit";
import { logNotification } from "@/lib/notifications";
import { sendNotificationEmail } from "@/lib/email";
import type { TicketStatus, TeamName, UserRole } from "@/types/db";
import { hasRole } from "@/types/db";

function canView(
  roles: UserRole[] | null | undefined,
  userTeam: TeamName | null,
  ticket: { requesterId: string; status: TicketStatus; teamName: TeamName }
) {
  if (hasRole(roles, "SUPER_ADMIN")) return true;
  if (ticket.requesterId && hasRole(roles, "REQUESTER")) return true;
  if (hasRole(roles, "PRODUCTION") && (ticket.status === "ASSIGNED_TO_PRODUCTION" || ticket.status === "DELIVERED_TO_REQUESTER")) return true;
  if (hasRole(roles, "FUNCTIONAL_HEAD") && userTeam && ticket.teamName === userTeam && ticket.status === "PENDING_FH_APPROVAL") return true;
  if (hasRole(roles, "L1_APPROVER") && userTeam && ticket.teamName === userTeam && ticket.status === "PENDING_L1_APPROVAL") return true;
  if (hasRole(roles, "CFO") && ticket.status === "PENDING_CFO_APPROVAL") return true;
  if (hasRole(roles, "CDO") && ticket.status === "PENDING_CDO_APPROVAL") return true;
  return false;
}

const TICKET_SELECT = `id, request_id AS "requestId", title, description, requester_name AS "requesterName", department,
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
  FROM tickets t LEFT JOIN users u ON t.requester_id = u.id`;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const rows = await query<Record<string, unknown>>(
    `${TICKET_JOIN_REQ} WHERE t.id = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ticket = {
    ...row,
    requester: (row.rId != null) ? { id: row.rId, email: row.rEmail, name: row.rName } : null,
  } as Record<string, unknown>;
  delete ticket.rId;
  delete ticket.rEmail;
  delete ticket.rName;

  const roles = session.user.roles ?? [];
  const userTeam = session.user.team ?? null;
  const isRequester = ticket.requesterId === session.user.id;
  if (!canView(roles, userTeam, ticket as { requesterId: string; status: TicketStatus; teamName: TeamName }) && !isRequester) {
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
  const ticketRow = await queryOne<{
    status: string;
    requesterId: string;
    teamName: string;
    title: string;
  }>(`SELECT status, requester_id AS "requesterId", team_name AS "teamName", title FROM tickets WHERE id = $1`, [id]);
  if (!ticketRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as ApprovalBody;
  const roles = session.user.roles ?? [];
  const userTeam = session.user.team ?? null;
  const ticket = ticketRow;

  if (body.action === "submit") {
    if (ticket.status !== "DRAFT") {
      return NextResponse.json({ error: "Only draft tickets can be submitted" }, { status: 400 });
    }
    if (ticket.requesterId !== session.user.id) {
      return NextResponse.json({ error: "Only the requester can submit" }, { status: 403 });
    }
    const initialStatus: TicketStatus =
      ticket.teamName === "SALES" ? "PENDING_L1_APPROVAL" : "PENDING_FH_APPROVAL";
    await query("UPDATE tickets SET status = $1, updated_at = now() WHERE id = $2", [initialStatus, id]);
    await logNotification({ ticketId: id, type: "assignment", recipient: "agent", payload: { status: initialStatus } });
    return NextResponse.json({ ok: true, status: initialStatus });
  }

  if (body.action === "mark_delivered") {
    if (ticket.status !== "ASSIGNED_TO_PRODUCTION" || !roles.includes("PRODUCTION")) {
      return NextResponse.json({ error: "Only Production can mark as delivered" }, { status: 403 });
    }
    await query(
      "UPDATE tickets SET status = 'DELIVERED_TO_REQUESTER', delivered_at = now(), updated_at = now() WHERE id = $1",
      [id]
    );
    const t = await queryOne<{ email: string | null }>(
      "SELECT u.email FROM tickets tk JOIN users u ON tk.requester_id = u.id WHERE tk.id = $1",
      [id]
    );
    if (t?.email) {
      await logNotification({ ticketId: id, type: "delivered", recipient: t.email, payload: { title: ticket.title } });
    }
    return NextResponse.json({ ok: true, status: "DELIVERED_TO_REQUESTER" });
  }

  if (body.action === "confirm_receipt") {
    if (ticket.status !== "DELIVERED_TO_REQUESTER" || ticket.requesterId !== session.user.id) {
      return NextResponse.json({ error: "Only the requester can confirm receipt" }, { status: 403 });
    }
    await query(
      "UPDATE tickets SET status = 'CONFIRMED_BY_REQUESTER', confirmed_at = now(), updated_at = now() WHERE id = $1",
      [id]
    );
    await query("UPDATE tickets SET status = 'CLOSED', updated_at = now() WHERE id = $1", [id]);
    await logNotification({
      ticketId: id,
      type: "closure",
      recipient: session.user.email,
      payload: { title: ticket.title },
    });
    return NextResponse.json({ ok: true, status: "CLOSED" });
  }

  const status = ticket.status as TicketStatus;
  const allowed = roleAndTeamForStatus[status];
  if (!allowed || !roles.includes(allowed.role as UserRole)) {
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
    await query(
      "UPDATE tickets SET status = 'REJECTED', rejection_remarks = $1, updated_at = now() WHERE id = $2",
      [body.remarks ?? null, id]
    );
    const requester = await queryOne<{ email: string | null }>("SELECT email FROM users WHERE id = $1", [ticket.requesterId]);
    if (requester?.email) {
      sendNotificationEmail("request_rejected", requester.email, id, {
        rejectionRemarks: body.remarks ?? "",
      }).catch((e) => console.error("[rejection email]", e));
    }
    return NextResponse.json({ ok: true, status: "REJECTED" });
  }

  const nextStatus = nextStatusOnApproval[status];
  if (!nextStatus) return NextResponse.json({ ok: true, status: ticket.status });

  await query("UPDATE tickets SET status = $1, updated_at = now() WHERE id = $2", [nextStatus, id]);

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
