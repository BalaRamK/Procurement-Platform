import { isRequesterForActiveRole } from "@/lib/tickets";
import type { TicketStatus, UserRole } from "@/types/db";
import { hasRole } from "@/types/db";

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

  if (activeRole === "PRODUCTION" || hasRole(roles, "PRODUCTION")) return true;
  if (activeRole === "FINANCE_APPROVER" && ticket.status === "PENDING_FINANCE_APPROVAL") return true;
  if (activeRole === "CFO" && ticket.status === "PENDING_CFO_APPROVAL") return true;
  return false;
}
