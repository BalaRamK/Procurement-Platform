import type { TicketStatus, TeamName, UserRole } from "@/types/db";
import { hasRole } from "@/types/db";

export function isRequesterForActiveRole(
  activeRole: UserRole | null | undefined,
  ticketRequesterId: string,
  currentUserId: string | null | undefined,
  requesterEmail?: string | null,
  sessionEmail?: string | null
) {
  if (activeRole !== "REQUESTER") return false;
  const normalizedRequesterEmail = requesterEmail?.trim().toLowerCase() ?? "";
  const normalizedSessionEmail = sessionEmail?.trim().toLowerCase() ?? "";
  return (
    (!!currentUserId && ticketRequesterId === currentUserId) ||
    (!!normalizedRequesterEmail && normalizedRequesterEmail === normalizedSessionEmail)
  );
}

const PRODUCTION_PREVIEW_STATUSES = new Set<TicketStatus>([
  "PENDING_FINANCE_APPROVAL",
  "PENDING_CFO_APPROVAL",
  "PENDING_CDO_APPROVAL",
  "ASSIGNED_TO_PRODUCTION",
  "ORDER_PLACED",
  "DELIVERED_TO_REQUESTER",
]);

export function canViewTicket(
  roles: UserRole[] | null | undefined,
  userTeam: TeamName | null,
  ticket: { requesterId: string; status: TicketStatus; teamName: TeamName },
  currentUserId?: string
) {
  if (hasRole(roles, "SUPER_ADMIN")) return true;
  if (currentUserId && ticket.requesterId === currentUserId && hasRole(roles, "REQUESTER")) return true;
  if (hasRole(roles, "VERTICAL_OWNER") && userTeam && ticket.teamName === userTeam) return true;
  // Production gets read-only visibility as soon as Department Head approval is done (so they can plan
  // ahead), well before the ticket is actually assigned to them — this also naturally covers the window
  // where Finance has requested an alternate quote, since that keeps the ticket at PENDING_FINANCE_APPROVAL.
  if (hasRole(roles, "PRODUCTION") && PRODUCTION_PREVIEW_STATUSES.has(ticket.status)) return true;
  if (hasRole(roles, "FUNCTIONAL_HEAD") && userTeam && ticket.teamName === userTeam && ticket.status === "PENDING_FH_APPROVAL") return true;
  if (hasRole(roles, "L1_APPROVER") && userTeam && ticket.teamName === userTeam && ticket.status === "PENDING_L1_APPROVAL") return true;
  if (hasRole(roles, "FINANCE_APPROVER") && ticket.status === "PENDING_FINANCE_APPROVAL") return true;
  if (hasRole(roles, "CFO") && ticket.status === "PENDING_CFO_APPROVAL") return true;
  if (hasRole(roles, "CDO") && ticket.status === "PENDING_CDO_APPROVAL") return true;
  return false;
}
