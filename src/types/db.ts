/**
 * Local mirror of Prisma enums and minimal model types.
 * Use these instead of importing from "@prisma/client" so the Next.js build
 * succeeds when the Prisma client is not generated (e.g. on CI/VM behind proxy).
 * Runtime still uses the real Prisma client from lib/prisma.ts.
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

/** Minimal User shape for component props (matches Prisma User) */
export interface User {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  team: TeamName | null;
  status: boolean;
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
