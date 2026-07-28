import { query, queryOne } from "@/lib/db";
import { logNotification } from "@/lib/notifications";

const ACTIVE_URGENT_STATUSES = [
  "PENDING_L1_APPROVAL",
  "PENDING_FH_APPROVAL",
  "PENDING_FINANCE_APPROVAL",
  "PENDING_CFO_APPROVAL",
  "PENDING_CDO_APPROVAL",
  "ASSIGNED_TO_PRODUCTION",
  "ORDER_PLACED",
] as const;

const STAGE_LABELS: Record<string, string> = {
  PENDING_L1_APPROVAL: "Pending L1 Approval",
  PENDING_FH_APPROVAL: "Pending Department Head Approval",
  PENDING_FINANCE_APPROVAL: "Pending Finance Approval",
  PENDING_CFO_APPROVAL: "Pending CFO Approval",
  PENDING_CDO_APPROVAL: "Pending CDO Approval",
  ASSIGNED_TO_PRODUCTION: "Assigned to Procurement Team",
  ORDER_PLACED: "Order Placed",
};

type DueTicket = {
  id: string;
  title: string;
  status: string;
  teamName: string;
  l1ManagerId: string | null;
};

async function recipientsFor(ticket: DueTicket) {
  if (ticket.status === "PENDING_L1_APPROVAL") {
    const rows = await query<{ email: string }>(
      `SELECT email FROM users
       WHERE status = true AND roles @> ARRAY['L1_APPROVER']::"UserRole"[]
         AND team = $1 AND ($2::uuid IS NULL OR id = $2)
       ORDER BY email`,
      [ticket.teamName, ticket.l1ManagerId]
    );
    return rows.map((row) => row.email);
  }

  const roleByStatus: Record<string, string> = {
    PENDING_FH_APPROVAL: "FUNCTIONAL_HEAD",
    PENDING_FINANCE_APPROVAL: "FINANCE_APPROVER",
    PENDING_CFO_APPROVAL: "CFO",
    PENDING_CDO_APPROVAL: "CDO",
    ASSIGNED_TO_PRODUCTION: "PRODUCTION",
    ORDER_PLACED: "PRODUCTION",
  };
  const role = roleByStatus[ticket.status];
  if (!role) return [];
  const teamScoped = ticket.status === "PENDING_FH_APPROVAL";
  const rows = await query<{ email: string }>(
    `SELECT email FROM users
     WHERE status = true AND roles @> ARRAY[$1::"UserRole"]
       AND ($2::boolean = false OR team = $3)
     ORDER BY email`,
    [role, teamScoped, ticket.teamName]
  );
  return rows.map((row) => row.email);
}

export async function sendDueUrgentReminders() {
  const due = await query<DueTicket>(
    `SELECT id, title, status, team_name AS "teamName", l1_manager_id AS "l1ManagerId"
     FROM tickets
     WHERE priority = 'URGENT'
       AND status = ANY($1::"TicketStatus"[])
       AND urgent_reminder_due_at <= now()
     ORDER BY urgent_reminder_due_at`,
    [ACTIVE_URGENT_STATUSES]
  );

  let ticketsProcessed = 0;
  let emailsQueued = 0;
  for (const ticket of due) {
    const claimed = await queryOne<{ id: string }>(
      `UPDATE tickets
       SET urgent_reminder_due_at = now() + interval '48 hours'
       WHERE id = $1 AND urgent_reminder_due_at <= now()
       RETURNING id`,
      [ticket.id]
    );
    if (!claimed) continue;

    const recipients = await recipientsFor(ticket);
    for (const recipient of recipients) {
      await logNotification({
        ticketId: ticket.id,
        type: "urgent_reminder",
        recipient,
        payload: {
          title: ticket.title,
          status: ticket.status,
          currentStage: STAGE_LABELS[ticket.status] ?? ticket.status,
          nextStage: STAGE_LABELS[ticket.status] ?? ticket.status,
          actionBy: "System urgent reminder",
          approverPosition: STAGE_LABELS[ticket.status] ?? ticket.status,
          approverName: recipient,
        },
        emailTrigger: "urgent_ticket_reminder",
      });
      emailsQueued++;
    }
    ticketsProcessed++;
  }

  return { ticketsProcessed, emailsQueued };
}
