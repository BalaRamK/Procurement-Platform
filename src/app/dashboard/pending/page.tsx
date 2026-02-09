import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { RequesterDashboard } from "@/components/dashboard/RequesterDashboard";
import { ApproverDashboard } from "@/components/dashboard/ApproverDashboard";
import { ProductionDashboard } from "@/components/dashboard/ProductionDashboard";
import { query } from "@/lib/db";
import type { Ticket, User } from "@/types/db";
import { getPrimaryRole } from "@/types/db";

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

function mapWithRequester(row: Record<string, unknown>) {
  const { rId, rEmail, rName, ...ticket } = row;
  return {
    ...ticket,
    requester: rId != null ? { id: rId, email: rEmail, name: rName } : null,
  };
}

export default async function PendingApprovalsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  const role = getPrimaryRole(session.user.roles);
  const userTeam = session.user.team ?? null;

  if (role === "REQUESTER") {
    const tickets = await query<Record<string, unknown>>(
      `SELECT id, request_id AS "requestId", title, status, requester_id AS "requesterId", updated_at AS "updatedAt"
       FROM tickets WHERE requester_id = $1 AND status IN ('DRAFT', 'DELIVERED_TO_REQUESTER') ORDER BY updated_at DESC`,
      [session.user.id]
    );
    return (
      <RequesterDashboard
        tickets={tickets as (Ticket & { requester?: User })[]}
        title="Pending your action"
        subtitle="Drafts to submit or delivered requests waiting for your confirmation."
      />
    );
  }

  if (role === "FUNCTIONAL_HEAD" && userTeam) {
    const rows = await query<Record<string, unknown>>(
      `${TICKET_JOIN_REQ} WHERE t.status = 'PENDING_FH_APPROVAL' AND t.team_name = $1 ORDER BY t.updated_at DESC`,
      [userTeam]
    );
    return <ApproverDashboard tickets={rows.map(mapWithRequester) as unknown as (Ticket & { requester: User })[]} role={role} teamName={userTeam} />;
  }

  if (role === "L1_APPROVER" && userTeam) {
    const rows = await query<Record<string, unknown>>(
      `${TICKET_JOIN_REQ} WHERE t.status = 'PENDING_L1_APPROVAL' AND t.team_name = $1 ORDER BY t.updated_at DESC`,
      [userTeam]
    );
    return <ApproverDashboard tickets={rows.map(mapWithRequester) as unknown as (Ticket & { requester: User })[]} role={role} teamName={userTeam} />;
  }

  if (role === "CFO") {
    const rows = await query<Record<string, unknown>>(
      `${TICKET_JOIN_REQ} WHERE t.status = 'PENDING_CFO_APPROVAL' ORDER BY t.updated_at DESC`
    );
    return <ApproverDashboard tickets={rows.map(mapWithRequester) as unknown as (Ticket & { requester: User })[]} role={role} />;
  }

  if (role === "CDO") {
    const rows = await query<Record<string, unknown>>(
      `${TICKET_JOIN_REQ} WHERE t.status = 'PENDING_CDO_APPROVAL' ORDER BY t.updated_at DESC`
    );
    return <ApproverDashboard tickets={rows.map(mapWithRequester) as unknown as (Ticket & { requester: User })[]} role={role} />;
  }

  if (role === "PRODUCTION") {
    const rows = await query<Record<string, unknown>>(
      `${TICKET_JOIN_REQ} WHERE t.status IN ('ASSIGNED_TO_PRODUCTION', 'DELIVERED_TO_REQUESTER') ORDER BY t.updated_at DESC`
    );
    return <ProductionDashboard tickets={rows.map(mapWithRequester) as unknown as (Ticket & { requester: User })[]} />;
  }

  if (role === "SUPER_ADMIN") {
    const rows = await query<Record<string, unknown>>(
      `${TICKET_JOIN_REQ} WHERE t.status NOT IN ('DRAFT', 'CLOSED', 'REJECTED', 'CONFIRMED_BY_REQUESTER') ORDER BY t.updated_at DESC`
    );
    return (
      <RequesterDashboard
        tickets={rows.map(mapWithRequester) as unknown as (Ticket & { requester: User })[]}
        showAll
        title="Pending (all in progress)"
        subtitle="All tickets currently in the approval or production pipeline."
      />
    );
  }

  return (
    <div className="card p-6 text-slate-600 backdrop-blur-md">
      No pending view for your role. Use <a href="/dashboard" className="text-primary-600 hover:underline">Dashboard</a>.
    </div>
  );
}
