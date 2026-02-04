import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { RequesterDashboard } from "@/components/dashboard/RequesterDashboard";
import { ApproverDashboard } from "@/components/dashboard/ApproverDashboard";
import { ProductionDashboard } from "@/components/dashboard/ProductionDashboard";
import { query } from "@/lib/db";
import type { Ticket, User } from "@/types/db";

const TICKET_JOIN_REQ = `SELECT t.id, t.request_id AS "requestId", t.title, t.description, t.requester_name AS "requesterName",
  t.department, t.component_description AS "componentDescription", t.item_name AS "itemName", t.team_name AS "teamName", t.priority, t.status,
  t.rejection_remarks AS "rejectionRemarks", t.requester_id AS "requesterId", t.created_at AS "createdAt", t.updated_at AS "updatedAt",
  u.id AS "rId", u.email AS "rEmail", u.name AS "rName"
  FROM tickets t LEFT JOIN users u ON t.requester_id = u.id`;

function mapWithRequester(row: Record<string, unknown>) {
  const { rId, rEmail, rName, ...ticket } = row;
  return { ...ticket, requester: rId != null ? { id: rId, email: rEmail, name: rName } : null };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const role = session.user.role ?? "REQUESTER";
  const userTeam = session.user.team ?? null;

  if (role === "REQUESTER") {
    const tickets = await query<Record<string, unknown>>(
      `SELECT id, request_id AS "requestId", title, description, requester_name AS "requesterName", department,
       component_description AS "componentDescription", item_name AS "itemName", team_name AS "teamName", priority, status,
       rejection_remarks AS "rejectionRemarks", requester_id AS "requesterId", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM tickets WHERE requester_id = $1 ORDER BY updated_at DESC`,
      [session.user.id]
    );
    return <RequesterDashboard tickets={tickets as (Ticket & { requester?: User })[]} />;
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
      `${TICKET_JOIN_REQ} ORDER BY t.updated_at DESC`
    );
    return <RequesterDashboard tickets={rows.map(mapWithRequester) as unknown as (Ticket & { requester: User })[]} showAll showNewRequestButton />;
  }

  return (
    <div className="card p-6 text-amber-800 backdrop-blur-md dark:text-amber-200">
      No dashboard configured for your role. Contact an administrator.
    </div>
  );
}
