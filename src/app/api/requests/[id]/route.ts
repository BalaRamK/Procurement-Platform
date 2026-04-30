import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { getAssigneesForTeam, getProductionEmails } from "@/lib/assignees";
import { logApproval } from "@/lib/audit";
import { logNotification } from "@/lib/notifications";
import { sendNotificationEmail } from "@/lib/email";
import type { TicketStatus, TeamName, UserRole } from "@/types/db";
import { canViewTicket } from "@/lib/tickets";
import { getPrimaryRole } from "@/types/db";

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
     cost_per_item AS "costPerItem", quantity, item_description AS "itemDescription", zoho_available AS "zohoAvailable"
     FROM ticket_line_items WHERE ticket_id = $1 ORDER BY sort_order ASC`,
    [id]
  );
  (ticket as Record<string, unknown>).lineItems = lineRows;

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
  const activeRole = session.user.activeRole ?? getPrimaryRole(session.user.roles);
  const roles = activeRole ? [activeRole] : [];
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
    const assignees = await getAssigneesForTeam(ticket.teamName as TeamName);
    const firstApprover =
      initialStatus === "PENDING_L1_APPROVAL" ? assignees.l1Approver : assignees.functionalHead;
    if (firstApprover?.email) {
      const emailTrigger =
        initialStatus === "PENDING_L1_APPROVAL"
          ? "request_submitted_to_l1"
          : "request_submitted_to_fh";
      await logNotification({
        ticketId: id,
        type: "assignment",
        recipient: firstApprover.email,
        payload: {
          status: initialStatus,
          title: ticket.title,
          currentStage: "Draft",
          nextStage: initialStatus === "PENDING_L1_APPROVAL" ? "Pending L1 Approval" : "Pending FH Approval",
          approverName: firstApprover.name ?? "",
        },
        emailTrigger,
      });
    }
    return NextResponse.json({ ok: true, status: initialStatus });
  }

  if (body.action === "mark_delivered") {
    if (ticket.status !== "ASSIGNED_TO_PRODUCTION" || activeRole !== "PRODUCTION") {
      return NextResponse.json({ error: "Only Production can mark as delivered" }, { status: 403 });
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
          currentStage: "Assigned to Production",
          nextStage: "Delivered to Requester",
        },
        emailTrigger: "production_marked_delivered",
      });
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
        nextStage: "Confirmed by Requester",
      },
      emailTrigger: "requester_confirmed_receipt",
    });
    return NextResponse.json({ ok: true, status: "CONFIRMED_BY_REQUESTER" });
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
        actionBy: session.user.name ?? session.user.email ?? "",
      }).catch((e) => console.error("[rejection email]", e));
    }
    return NextResponse.json({ ok: true, status: "REJECTED" });
  }

  const nextStatus = nextStatusOnApproval[status];
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
          : nextStatus === "PENDING_CFO_APPROVAL"
            ? assignees.cfo
            : nextStatus === "PENDING_CDO_APPROVAL"
              ? assignees.cdo
              : null;
    if (nextAssignee?.email) {
      const emailTrigger =
        nextStatus === "PENDING_L1_APPROVAL"
          ? "fh_approved_moved_to_l1"
          : nextStatus === "PENDING_CFO_APPROVAL"
            ? "l1_approved_moved_to_cfo"
            : nextStatus === "PENDING_CDO_APPROVAL"
              ? "cfo_approved_moved_to_cdo"
              : "request_submitted_to_fh";
      await logNotification({
        ticketId: id,
        type: "assignment",
        recipient: nextAssignee.email,
        payload: {
          status: nextStatus,
          title: ticket.title,
          currentStage: status,
          nextStage:
            nextStatus === "PENDING_L1_APPROVAL"
              ? "Pending L1 Approval"
              : nextStatus === "PENDING_CFO_APPROVAL"
                ? "Pending CFO Approval"
                : nextStatus === "PENDING_CDO_APPROVAL"
                  ? "Pending CDO Approval"
                  : nextStatus,
          approverName: nextAssignee.name ?? "",
          actionBy: session.user.name ?? session.user.email ?? "",
        },
        emailTrigger,
      });
    }
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}
