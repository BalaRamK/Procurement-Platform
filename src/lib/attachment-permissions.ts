import { isRequesterForActiveRole } from "@/lib/tickets";
import type { TicketStatus, UserRole } from "@/types/db";
import { hasRole } from "@/types/db";

const PRODUCTION_UPLOAD_STATUSES = new Set<TicketStatus>([
  "ASSIGNED_TO_PRODUCTION",
  "ORDER_PLACED",
  "DELIVERED_TO_REQUESTER",
]);

export function canUploadAttachment({
  activeRole,
  roles,
  ticket,
  currentUserId,
  sessionEmail,
}: {
  activeRole: UserRole | null | undefined;
  roles: UserRole[] | null | undefined;
  ticket: {
    requesterId: string;
    requesterEmail?: string | null;
    status: TicketStatus;
    alternateQuoteState?: string | null;
  };
  currentUserId?: string | null;
  sessionEmail?: string | null;
}) {
  if (
    isRequesterForActiveRole(
      activeRole,
      ticket.requesterId,
      currentUserId,
      ticket.requesterEmail,
      sessionEmail
    )
  ) {
    return true;
  }

  if (activeRole === "PRODUCTION" || hasRole(roles, "PRODUCTION")) {
    // Production can only add attachments once the ticket is actually theirs to work on, or while
    // Finance has asked them for an alternate quote (still PENDING_FINANCE_APPROVAL at that point).
    // Read-only preview access to earlier approval stages must not imply upload access.
    return (
      PRODUCTION_UPLOAD_STATUSES.has(ticket.status) ||
      (ticket.status === "PENDING_FINANCE_APPROVAL" && ticket.alternateQuoteState === "REQUESTED")
    );
  }
  if (activeRole === "FINANCE_APPROVER" && ticket.status === "PENDING_FINANCE_APPROVAL") return true;
  if (activeRole === "CFO" && ticket.status === "PENDING_CFO_APPROVAL") return true;
  return false;
}
