/**
 * Shared enum and model types for the app.
 * Database access uses PostgreSQL via pg (src/lib/db.ts).
 */

export const USER_ROLES = [
  "SUPER_ADMIN",
  "REQUESTER",
  "FUNCTIONAL_HEAD",
  "L1_APPROVER",
  "CFO",
  "CDO",
  "PRODUCTION",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const TEAM_NAMES = ["INNOVATION", "ENGINEERING", "SALES"] as const;
export type TeamName = (typeof TEAM_NAMES)[number];

export const TICKET_STATUSES = [
  "DRAFT",
  "PENDING_FH_APPROVAL",
  "PENDING_L1_APPROVAL",
  "PENDING_CFO_APPROVAL",
  "PENDING_CDO_APPROVAL",
  "ASSIGNED_TO_PRODUCTION",
  "DELIVERED_TO_REQUESTER",
  "CONFIRMED_BY_REQUESTER",
  "CLOSED",
  "REJECTED",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const COST_CURRENCIES = ["USD", "INR", "EUR"] as const;
export type CostCurrency = (typeof COST_CURRENCIES)[number];

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Minimal User shape for component props */
export interface User {
  id: string;
  email: string;
  profileName?: string;
  name: string | null;
  roles: UserRole[];
  team: TeamName | null;
  status: boolean;
}

/** Primary role for dashboard view (highest privilege in list) */
const ROLE_ORDER: UserRole[] = [
  "SUPER_ADMIN",
  "PRODUCTION",
  "CDO",
  "CFO",
  "L1_APPROVER",
  "FUNCTIONAL_HEAD",
  "REQUESTER",
];

export function getPrimaryRole(roles: UserRole[] | null | undefined): UserRole {
  if (!roles?.length) return "REQUESTER";
  for (const r of ROLE_ORDER) {
    if (roles.includes(r)) return r;
  }
  return roles[0];
}

export function hasRole(roles: UserRole[] | null | undefined, role: UserRole): boolean {
  return Array.isArray(roles) && roles.includes(role);
}

/** Normalize DB/session roles to an array (handles legacy single role string or array). */
export function asRolesArray(roles: unknown): UserRole[] {
  if (Array.isArray(roles)) {
    return roles.filter((r): r is UserRole => typeof r === "string" && (USER_ROLES as readonly string[]).includes(r));
  }
  if (typeof roles === "string" && USER_ROLES.includes(roles as UserRole)) {
    return [roles as UserRole];
  }
  return [];
}

/** Minimal Ticket shape for component props (matches Prisma Ticket) */
export interface Ticket {
  id: string;
  title: string;
  status: TicketStatus;
  requestId: string | null;
  teamName: TeamName;
  updatedAt: Date;
  requesterName?: string;
  itemName?: string | null;
  componentDescription?: string | null;
  quantity?: number | null;
  [key: string]: unknown;
}
