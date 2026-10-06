import { queryOne } from "@/lib/db";
import { canViewTicket } from "@/lib/tickets";
import type { TeamName, TicketStatus, UserRole } from "@/types/db";

/**
 * True if the user has already acted on the ticket (approval log entry) or was @mentioned in one of its
 * comments. These users keep read-only access even after the ticket has moved past their stage.
 */
export async function hasTicketInvolvement(ticketId: string, userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const row = await queryOne<{ involved: boolean }>(
    `SELECT (
       EXISTS (SELECT 1 FROM approval_logs WHERE ticket_id = $1 AND user_id = $2)
       OR EXISTS (
         SELECT 1 FROM comments
         WHERE ticket_id = $1 AND position('(' || $2::text || ')' in body) > 0
       )
     ) AS involved`,
    [ticketId, userId]
  );
  return !!row?.involved;
}

export async function canAccessTicket(
  roles: UserRole[] | null | undefined,
  userTeam: TeamName | null,
  ticket: { id?: string; requesterId: string; status: TicketStatus; teamName: TeamName },
  ticketId: string,
  currentUserId: string | null | undefined
) {
  if (currentUserId && ticket.requesterId === currentUserId) return true;
  if (canViewTicket(roles, userTeam, ticket, currentUserId ?? undefined)) return true;
  return hasTicketInvolvement(ticketId, currentUserId);
}
