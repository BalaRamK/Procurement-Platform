import type { UserRole } from "@prisma/client";

/**
 * User-facing role names per functional requirements:
 * Requester, Department Head, L1 Approver, Finance Team, CDO, Procurement Team, Admin.
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Admin",
  REQUESTER: "Requester",
  FUNCTIONAL_HEAD: "Department Head",
  L1_APPROVER: "L1 Approver",
  CFO: "Finance Team",
  CDO: "CDO Approval",
  PRODUCTION: "Procurement Team",
};

/**
 * Ticket lifecycle: Open → Pending FH → Pending L1 → Pending CFO → Pending CDO
 * → Assigned to Production → Delivered to Requester → Confirmed by Requester → Closed.
 * DRAFT is shown as "Open".
 */
export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Open",
  PENDING_FH_APPROVAL: "Pending FH Approval",
  PENDING_L1_APPROVAL: "Pending L1 Approval",
  PENDING_CFO_APPROVAL: "Pending CFO Approval",
  PENDING_CDO_APPROVAL: "Pending CDO Approval",
  ASSIGNED_TO_PRODUCTION: "Assigned to Production",
  DELIVERED_TO_REQUESTER: "Delivered to Requester",
  CONFIRMED_BY_REQUESTER: "Confirmed by Requester",
  CLOSED: "Closed",
  REJECTED: "Rejected",
};
