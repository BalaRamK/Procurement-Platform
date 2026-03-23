import type { TicketStatus, TeamName, UserRole } from "@/types/db";
import { hasRole } from "@/types/db";

export function canViewTicket(
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
