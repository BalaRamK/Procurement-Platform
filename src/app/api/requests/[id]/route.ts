import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { getAssigneesForTeam, getProductionEmails } from "@/lib/assignees";
import { logApproval } from "@/lib/audit";
import { logNotification } from "@/lib/notifications";
import { sendNotificationEmail } from "@/lib/email";
import type { TicketStatus, TeamName, UserRole } from "@/types/db";
import { canViewTicket, isRequesterForActiveRole } from "@/lib/tickets";
import { getPrimaryRole } from "@/types/db";

const STAGE_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_L1_APPROVAL: "Pending L1 Approval",
  PENDING_FH_APPROVAL: "Pending Department Head Approval",
  PENDING_FINANCE_APPROVAL: "Pending Finance Approval",
  PENDING_CFO_APPROVAL: "Pending CFO Approval",
  PENDING_CDO_APPROVAL: "Pending CDO Approval",
  ASSIGNED_TO_PRODUCTION: "Assigned to Production",
  ORDER_PLACED: "Order Placed",
  DELIVERED_TO_REQUESTER: "Delivered to Requester",
  CONFIRMED_BY_REQUESTER: "Confirmed by Requester",
  CLOSED: "Closed",
  REJECTED: "Rejected",
};

const ROLE_POSITION_LABELS: Partial<Record<UserRole, string>> = {
  L1_APPROVER: "L1 Approver",
  FUNCTIONAL_HEAD: "Department Head",
  FINANCE_APPROVER: "Finance Approval",
  CFO: "Finance Team",
  CDO: "CDO Approval",
  PRODUCTION: "Procurement Team",
};

function actorName(sessionUser: { name?: string | null; email?: string | null }) {
  return sessionUser.name || sessionUser.email || "System";
}

function assigneeLabel(position: string, assignee?: { name: string | null; email: string } | null) {
  if (!assignee) return position;
  return `${position}: ${assignee.name || assignee.email}`;
}

const TICKET_SELECT = `id, request_id AS "requestId", title, description, requester_name AS "requesterName", department,
  component_description AS "componentDescription", item_name AS "itemName", brand_name_company AS "brandNameCompany",
  preferred_supplier AS "preferredSupplier", country_of_origin AS "countryOfOrigin", bom_id AS "bomId", product_id AS "productId",
  project_customer AS "projectCustomer", need_by_date AS "needByDate", charge_code AS "chargeCode",
  cost_currency AS "costCurrency", estimated_cost AS "estimatedCost", rate, unit, estimated_po_date AS "estimatedPoDate",
  place_of_delivery AS "placeOfDelivery", quantity, deal_name AS "dealName", team_name AS "teamName", priority, status,
  rejection_remarks AS "rejectionRemarks", requester_id AS "requesterId", delivered_at AS "deliveredAt",
  confirmed_at AS "confirmedAt", auto_closed_at AS "autoClosedAt", created_at AS "createdAt", updated_at AS "updatedAt"`;

const TICKET_JOIN_REQ = `SELECT t.id, t.request_id AS "requestId", t.title, t.description, t.requester_name AS "requesterName",
  t.department, t.component_description AS "componentDescription", t.item_name AS "itemName",
  t.brand_name_company AS "brandNameCompany", t.preferred_supplier AS "preferredSupplier",
  t.country_of_origin AS "countryOfOrigin", t.bom_id AS "bomId", t.product_id AS "productId",
  t.project_customer AS "projectCustomer", t.need_by_date AS "needByDate",
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

  const activeRole = session.user.activeRole ?? getPrimaryRole(session.user.roles);
  const roles = activeRole ? [activeRole] : [];
  const userTeam = session.user.team ?? null;
  const isRequester = ticket.requesterId === session.user.id;
  if (!canViewTicket(roles, userTeam, ticket as { requesterId: string; status: TicketStatus; teamName: TeamName }, session.user.id) && !isRequester) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const lineRows = await query<Record<string, unknown>>(
    `SELECT id, sort_order AS "sortOrder", component_name AS "componentName", bom_id AS "bomId",
     cost_per_item AS "costPerItem", quantity, item_description AS "itemDescription",
     manufacturer, preferred_supplier AS "preferredSupplier", country_of_origin AS "countryOfOrigin",
     extra_spares AS "extraSpares", remarks, zoho_available AS "zohoAvailable"
     FROM ticket_line_items WHERE ticket_id = $1 ORDER BY sort_order ASC`,
    [id]
  );
  (ticket as Record<string, unknown>).lineItems = lineRows;

  return NextResponse.json(ticket);
}

type ApprovalBody = { action: "approved" | "rejected" | "submit" | "order_placed" | "mark_delivered" | "confirm_receipt"; remarks?: string };

const nextStatusOnApproval: Partial<Record<TicketStatus, TicketStatus>> = {
  PENDING_L1_APPROVAL: "PENDING_FH_APPROVAL",
  PENDING_FINANCE_APPROVAL: "PENDING_CFO_APPROVAL",
  PENDING_CFO_APPROVAL: "PENDING_CDO_APPROVAL",
  PENDING_CDO_APPROVAL: "ASSIGNED_TO_PRODUCTION",
};

async function shouldRouteThroughFinance(ticketId: string, ticketBomId?: string | null) {
  const summary = await queryOne<{ total: number; available: number; unknown: number }>(
    `SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE zoho_available IS TRUE)::int AS available,
      COUNT(*) FILTER (WHERE zoho_available IS NULL)::int AS unknown
     FROM ticket_line_items WHERE ticket_id = $1`,
    [ticketId]
  );
  const total = summary?.total ?? 0;
  if (total > 0) return summary?.available !== total || (summary?.unknown ?? 0) > 0;
  return !ticketBomId?.trim();
}

const roleAndTeamForStatus: Record<TicketStatus, { role: string; teamRequired: boolean } | null> = {
  PENDING_FH_APPROVAL: { role: "FUNCTIONAL_HEAD", teamRequired: true },
  PENDING_L1_APPROVAL: { role: "L1_APPROVER", teamRequired: true },
  PENDING_FINANCE_APPROVAL: { role: "FINANCE_APPROVER", teamRequired: false },
  PENDING_CFO_APPROVAL: { role: "CFO", teamRequired: false },
  PENDING_CDO_APPROVAL: { role: "CDO", teamRequired: false },
  DRAFT: null,
  ASSIGNED_TO_PRODUCTION: null,
  ORDER_PLACED: null,
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
    requesterEmail: string | null;
    teamName: string;
    title: string;
    bomId: string | null;
  }>(
    `SELECT t.status, t.requester_id AS "requesterId", u.email AS "requesterEmail", t.team_name AS "teamName", t.title, t.bom_id AS "bomId"
     FROM tickets t LEFT JOIN users u ON t.requester_id = u.id WHERE t.id = $1`,
    [id]
  );
  if (!ticketRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as ApprovalBody;
  const activeRole = session.user.activeRole ?? getPrimaryRole(session.user.roles);
  const roles = activeRole ? [activeRole] : [];
  const userTeam = session.user.team ?? null;
  const ticket = ticketRow;
  const requesterEmail = ticket.requesterEmail?.trim().toLowerCase() ?? "";
  const sessionEmail = session.user.email.trim().toLowerCase();
  const isRequester = isRequesterForActiveRole(activeRole, ticket.requesterId, session.user.id, requesterEmail, sessionEmail);
  const isProduction = activeRole === "PRODUCTION" || session.user.roles?.includes("PRODUCTION");

  if (body.action === "submit") {
    if (ticket.status !== "DRAFT") {
      return NextResponse.json({ error: "Only draft tickets can be submitted" }, { status: 400 });
    }
    if (!isRequester) {
      return NextResponse.json({ error: "Only the requester can submit" }, { status: 403 });
    }
    const initialStatus: TicketStatus = "PENDING_L1_APPROVAL";
    await query("UPDATE tickets SET status = $1, updated_at = now() WHERE id = $2", [initialStatus, id]);
    const assignees = await getAssigneesForTeam(ticket.teamName as TeamName);
    const firstApprover = assignees.l1Approver;
    if (firstApprover?.email) {
      await logNotification({
        ticketId: id,
        type: "assignment",
        recipient: firstApprover.email,
        payload: {
          status: initialStatus,
          title: ticket.title,
          currentStage: "Draft",
          nextStage: STAGE_LABELS[initialStatus],
          actionBy: actorName(session.user),
          approverPosition: "L1 Approver",
          approverName: assigneeLabel("L1 Approver", firstApprover),
        },
        emailTrigger: "request_submitted_to_l1",
      });
    }
    return NextResponse.json({ ok: true, status: initialStatus });
  }

  if (body.action === "order_placed") {
    if (ticket.status !== "ASSIGNED_TO_PRODUCTION" || !isProduction) {
      return NextResponse.json({ error: "Only Procurement Team can mark an order as placed" }, { status: 403 });
    }
    await query(
      "UPDATE tickets SET status = 'ORDER_PLACED', updated_at = now() WHERE id = $1",
      [id]
    );
    await logApproval({
      ticketId: id,
      userEmail: session.user.email,
      userId: session.user.id,
      action: "order_placed",
    });
    const t = await queryOne<{ email: string | null }>(
      "SELECT u.email FROM tickets tk JOIN users u ON tk.requester_id = u.id WHERE tk.id = $1",
      [id]
    );
    if (t?.email) {
      await logNotification({
        ticketId: id,
        type: "order_placed",
        recipient: t.email,
        payload: {
          title: ticket.title,
          currentStage: "Assigned to Production",
          nextStage: "Order Placed",
          actionBy: actorName(session.user),
          approverPosition: "Requester",
          approverName: assigneeLabel("Requester", { name: null, email: t.email }),
        },
        emailTrigger: "production_marked_order_placed",
      });
    }
    return NextResponse.json({ ok: true, status: "ORDER_PLACED" });
  }

  if (body.action === "mark_delivered") {
    if (ticket.status !== "ORDER_PLACED" || !isProduction) {
      return NextResponse.json({ error: "Only Procurement Team can mark as delivered after the order is placed" }, { status: 403 });
    }
    await query(
      "UPDATE tickets SET status = 'DELIVERED_TO_REQUESTER', delivered_at = now(), updated_at = now() WHERE id = $1",
      [id]
    );
    await logApproval({
      ticketId: id,
      userEmail: session.user.email,
      userId: session.user.id,
      action: "mark_delivered",
    });
    const t = await queryOne<{ email: string | null }>(
      "SELECT u.email FROM tickets tk JOIN users u ON tk.requester_id = u.id WHERE tk.id = $1",
      [id]
    );
    if (t?.email) {
      await logNotification({
        ticketId: id,
        type: "delivered",
        recipient: t.email,
        payload: {
          title: ticket.title,
          currentStage: "Order Placed",
          nextStage: "Delivered to Requester",
          actionBy: actorName(session.user),
          approverPosition: "Requester",
          approverName: assigneeLabel("Requester", { name: null, email: t.email }),
        },
        emailTrigger: "production_marked_delivered",
      });
    }
    return NextResponse.json({ ok: true, status: "DELIVERED_TO_REQUESTER" });
  }

  if (body.action === "confirm_receipt") {
    if (ticket.status !== "DELIVERED_TO_REQUESTER" || !isRequester) {
      return NextResponse.json({ error: "Only the requester can confirm receipt" }, { status: 403 });
    }
    await query(
      "UPDATE tickets SET status = 'CLOSED', confirmed_at = now(), auto_closed_at = now(), updated_at = now() WHERE id = $1",
      [id]
    );
    await logApproval({
      ticketId: id,
      userEmail: session.user.email,
      userId: session.user.id,
      action: "confirm_receipt",
    });
    await logNotification({
      ticketId: id,
      type: "closure",
      recipient: session.user.email,
      payload: {
        title: ticket.title,
        currentStage: "Delivered to Requester",
        nextStage: "Closed",
        actionBy: actorName(session.user),
        approverPosition: "Not applicable",
        approverName: "Not applicable",
      },
      emailTrigger: "requester_confirmed_receipt",
    });
    return NextResponse.json({ ok: true, status: "CLOSED" });
  }

  const status = ticket.status as TicketStatus;
  const allowed = roleAndTeamForStatus[status];
  if (!allowed || activeRole !== (allowed.role as UserRole)) {
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
        currentStage: status,
        nextStage: "Rejected",
        actionBy: actorName(session.user),
        approverPosition: "Not applicable",
        approverName: "Not applicable",
      }).catch((e) => console.error("[rejection email]", e));
    }
    return NextResponse.json({ ok: true, status: "REJECTED" });
  }

  const nextStatus =
    status === "PENDING_FH_APPROVAL"
      ? (await shouldRouteThroughFinance(id, ticket.bomId) ? "PENDING_FINANCE_APPROVAL" : "PENDING_CFO_APPROVAL")
      : nextStatusOnApproval[status];
  if (!nextStatus) return NextResponse.json({ ok: true, status: ticket.status });

  await query("UPDATE tickets SET status = $1, updated_at = now() WHERE id = $2", [nextStatus, id]);

  const assignees = await getAssigneesForTeam(ticket.teamName as TeamName);
  if (nextStatus === "ASSIGNED_TO_PRODUCTION") {
    const productionEmails = await getProductionEmails();
    for (const email of productionEmails) {
      await logNotification({
        ticketId: id,
        type: "team_assignment",
        recipient: email,
        payload: {
          title: ticket.title,
          status: nextStatus,
          currentStage: "Pending CDO Approval",
          nextStage: "Assigned to Production",
          actionBy: actorName(session.user),
          approverPosition: "Procurement Team",
          approverName: "Procurement Team",
        },
        emailTrigger: "cdo_approved_moved_to_production",
      });
    }
  } else {
      const nextAssignee =
      nextStatus === "PENDING_FH_APPROVAL"
        ? assignees.functionalHead
        : nextStatus === "PENDING_L1_APPROVAL"
          ? assignees.l1Approver
          : nextStatus === "PENDING_FINANCE_APPROVAL"
            ? assignees.financeApprover
          : nextStatus === "PENDING_CFO_APPROVAL"
            ? assignees.cfo
            : nextStatus === "PENDING_CDO_APPROVAL"
              ? assignees.cdo
              : null;
    if (nextAssignee?.email) {
      const emailTrigger =
        nextStatus === "PENDING_FH_APPROVAL"
          ? "l1_approved_moved_to_fh"
          : nextStatus === "PENDING_FINANCE_APPROVAL"
            ? "fh_approved_moved_to_finance"
          : nextStatus === "PENDING_CFO_APPROVAL"
            ? status === "PENDING_FINANCE_APPROVAL"
              ? "finance_approved_moved_to_cfo"
              : "fh_approved_moved_to_cfo"
            : nextStatus === "PENDING_CDO_APPROVAL"
              ? "cfo_approved_moved_to_cdo"
              : "request_submitted_to_l1";
      const nextRole =
        nextStatus === "PENDING_FH_APPROVAL"
          ? "FUNCTIONAL_HEAD"
          : nextStatus === "PENDING_FINANCE_APPROVAL"
            ? "FINANCE_APPROVER"
          : nextStatus === "PENDING_CFO_APPROVAL"
            ? "CFO"
            : nextStatus === "PENDING_CDO_APPROVAL"
              ? "CDO"
              : null;
      const nextPosition = nextRole ? ROLE_POSITION_LABELS[nextRole] ?? nextStatus : nextStatus;
      await logNotification({
        ticketId: id,
        type: "assignment",
        recipient: nextAssignee.email,
        payload: {
          status: nextStatus,
          title: ticket.title,
          currentStage: STAGE_LABELS[status] ?? status,
          nextStage: STAGE_LABELS[nextStatus] ?? nextStatus,
          approverPosition: nextPosition,
          approverName: assigneeLabel(nextPosition, nextAssignee),
          actionBy: actorName(session.user),
        },
        emailTrigger,
      });
    }
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}
