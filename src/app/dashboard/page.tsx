import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { RequesterDashboard } from "@/components/dashboard/RequesterDashboard";
import { ApproverDashboard } from "@/components/dashboard/ApproverDashboard";
import { ProductionDashboard } from "@/components/dashboard/ProductionDashboard";
import { query } from "@/lib/db";
import type { Ticket, User } from "@/types/db";
import { getPrimaryRole } from "@/types/db";

const TICKET_JOIN_REQ = `SELECT t.id, t.request_id AS "requestId", t.title, t.description, t.requester_name AS "requesterName",
  t.department, t.component_description AS "componentDescription", t.item_name AS "itemName", t.team_name AS "teamName", t.priority, t.status,
  t.rejection_remarks AS "rejectionRemarks", t.requester_id AS "requesterId", t.created_at AS "createdAt", t.updated_at AS "updatedAt",
  u.id AS "rId", u.email AS "rEmail", u.name AS "rName"
  FROM tickets t LEFT JOIN users u ON t.requester_id = u.id`;

function mapWithRequester(row: Record<string, unknown>) {
  const { rId, rEmail, rName, ...ticket } = row;
  return { ...ticket, requester: rId != null ? { id: rId, email: rEmail, name: rName } : null };
}

function searchClauseTicketsOnly(q: string | undefined): { sql: string; param: string } | null {
  const trimmed = q?.trim();
  if (!trimmed) return null;
  const param = `%${trimmed}%`;
  return {
    sql: ` AND (title ILIKE $q OR request_id ILIKE $q OR requester_name ILIKE $q)`,
    param,
  };
}

function searchClause(q: string | undefined): { param: string } | null {
  const trimmed = q?.trim();
  if (!trimmed) return null;
  return { param: `%${trimmed}%` };
}

export default async function DashboardPage({
  searchParams = {},
}: {
  searchParams?: Promise<{ q?: string }> | { q?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const resolved = searchParams && typeof (searchParams as Promise<unknown>).then === "function"
    ? await (searchParams as Promise<{ q?: string }>)
    : (searchParams as { q?: string }) ?? {};
  const q = resolved.q;
  const role = getPrimaryRole(session.user.roles);
  const userTeam = session.user.team ?? null;

  const searchTickets = searchClauseTicketsOnly(q);
  const searchJoin = searchClause(q);

  if (role === "REQUESTER") {
    const where = ["requester_id = $1"];
    const args: (string | undefined)[] = [session.user.id];
    if (searchTickets) {
      where.push("(title ILIKE $2 OR request_id ILIKE $2 OR requester_name ILIKE $2)");
      args.push(searchTickets.param);
    }
    const tickets = await query<Record<string, unknown>>(
      `SELECT id, request_id AS "requestId", title, description, requester_name AS "requesterName", department,
       component_description AS "componentDescription", item_name AS "itemName", team_name AS "teamName", priority, status,
       rejection_remarks AS "rejectionRemarks", requester_id AS "requesterId", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM tickets WHERE ${where.join(" AND ")} ORDER BY updated_at DESC`,
      args
    );
    return <RequesterDashboard tickets={tickets as (Ticket & { requester?: User })[]} />;
  }

  if (role === "FUNCTIONAL_HEAD" && userTeam) {
    const where = ["t.status = 'PENDING_FH_APPROVAL'", "t.team_name = $1"];
    const args: (string | undefined)[] = [userTeam];
    if (searchJoin) {
      where.push("(t.title ILIKE $2 OR t.request_id ILIKE $2 OR t.requester_name ILIKE $2 OR u.email ILIKE $2 OR u.name ILIKE $2)");
      args.push(searchJoin.param);
    }
    const rows = await query<Record<string, unknown>>(
      `${TICKET_JOIN_REQ} WHERE ${where.join(" AND ")} ORDER BY t.updated_at DESC`,
      args
    );
    return <ApproverDashboard tickets={rows.map(mapWithRequester) as unknown as (Ticket & { requester: User })[]} role={role} teamName={userTeam} />;
  }

  if (role === "L1_APPROVER" && userTeam) {
    const where = ["t.status = 'PENDING_L1_APPROVAL'", "t.team_name = $1"];
    const args: (string | undefined)[] = [userTeam];
    if (searchJoin) {
      where.push("(t.title ILIKE $2 OR t.request_id ILIKE $2 OR t.requester_name ILIKE $2 OR u.email ILIKE $2 OR u.name ILIKE $2)");
      args.push(searchJoin.param);
    }
    const rows = await query<Record<string, unknown>>(
      `${TICKET_JOIN_REQ} WHERE ${where.join(" AND ")} ORDER BY t.updated_at DESC`,
      args
    );
    return <ApproverDashboard tickets={rows.map(mapWithRequester) as unknown as (Ticket & { requester: User })[]} role={role} teamName={userTeam} />;
  }

  if (role === "CFO") {
    const where = ["t.status = 'PENDING_CFO_APPROVAL'"];
    const args: (string | undefined)[] = [];
    if (searchJoin) {
      where.push("(t.title ILIKE $1 OR t.request_id ILIKE $1 OR t.requester_name ILIKE $1 OR u.email ILIKE $1 OR u.name ILIKE $1)");
      args.push(searchJoin.param);
    }
    const rows = await query<Record<string, unknown>>(
      `${TICKET_JOIN_REQ} WHERE ${where.join(" AND ")} ORDER BY t.updated_at DESC`,
      args
    );
    return <ApproverDashboard tickets={rows.map(mapWithRequester) as unknown as (Ticket & { requester: User })[]} role={role} />;
  }

  if (role === "CDO") {
    const where = ["t.status = 'PENDING_CDO_APPROVAL'"];
    const args: (string | undefined)[] = [];
    if (searchJoin) {
      where.push("(t.title ILIKE $1 OR t.request_id ILIKE $1 OR t.requester_name ILIKE $1 OR u.email ILIKE $1 OR u.name ILIKE $1)");
      args.push(searchJoin.param);
    }
    const rows = await query<Record<string, unknown>>(
      `${TICKET_JOIN_REQ} WHERE ${where.join(" AND ")} ORDER BY t.updated_at DESC`,
      args
    );
    return <ApproverDashboard tickets={rows.map(mapWithRequester) as unknown as (Ticket & { requester: User })[]} role={role} />;
  }

  if (role === "PRODUCTION") {
    const where = ["t.status IN ('ASSIGNED_TO_PRODUCTION', 'DELIVERED_TO_REQUESTER')"];
    const args: (string | undefined)[] = [];
    if (searchJoin) {
      where.push("(t.title ILIKE $1 OR t.request_id ILIKE $1 OR t.requester_name ILIKE $1 OR u.email ILIKE $1 OR u.name ILIKE $1)");
      args.push(searchJoin.param);
    }
    const rows = await query<Record<string, unknown>>(
      `${TICKET_JOIN_REQ} WHERE ${where.join(" AND ")} ORDER BY t.updated_at DESC`,
      args
    );
    return <ProductionDashboard tickets={rows.map(mapWithRequester) as unknown as (Ticket & { requester: User })[]} />;
  }

  if (role === "SUPER_ADMIN") {
    const where: string[] = [];
    const args: (string | undefined)[] = [];
    if (searchJoin) {
      where.push("(t.title ILIKE $1 OR t.request_id ILIKE $1 OR t.requester_name ILIKE $1 OR u.email ILIKE $1 OR u.name ILIKE $1)");
      args.push(searchJoin.param);
    }
    const rows = await query<Record<string, unknown>>(
      `${TICKET_JOIN_REQ} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY t.updated_at DESC`,
      args
    );
    return <RequesterDashboard tickets={rows.map(mapWithRequester) as unknown as (Ticket & { requester: User })[]} showAll showNewRequestButton />;
  }

  return (
    <div className="card p-6 text-amber-800 backdrop-blur-md dark:text-amber-200">
      No dashboard configured for your role. Contact an administrator.
    </div>
  );
}
