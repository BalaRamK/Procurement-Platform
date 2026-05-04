"use client";

import Link from "next/link";
import type { TeamName, Ticket, User, UserRole } from "@/types/db";
import { ROLE_LABELS } from "@/lib/constants";
import { DashboardHero, EmptyDashboardState, MetricTile, PriorityPill, formatShortDate } from "./DashboardShared";

type TicketWithRequester = Ticket & { requester: User };
export type ApprovalHistoryTicket = TicketWithRequester & {
  approvalAction: "approved" | "rejected";
  approvalRemarks?: string | null;
  approvalAt: string | Date;
};

function daysSince(date: string | Date) {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

export function ApproverDashboardEnhanced({
  tickets,
  role,
  teamName,
  title,
  subtitle,
  historyTickets = [],
}: {
  tickets: TicketWithRequester[];
  historyTickets?: ApprovalHistoryTicket[];
  role: UserRole;
  teamName?: TeamName | null;
  title?: string;
  subtitle?: string;
}) {
  const defaultSub = teamName ? `${ROLE_LABELS[role] ?? role} (${teamName})` : ROLE_LABELS[role] ?? role;
  const heading = title ?? "Action required";
  const sub = subtitle ?? `Tickets waiting for your approval as ${defaultSub}.`;
  const urgentHigh = tickets.filter((ticket) => ticket.priority === "URGENT" || ticket.priority === "HIGH").length;
  const oldest = tickets.length > 0 ? Math.max(...tickets.map((ticket) => daysSince(ticket.createdAt as string | Date))) : null;

  return (
    <div className="space-y-6">
      <DashboardHero eyebrow="Approval queue" title={heading} description={sub} />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricTile label="Pending approval" value={tickets.length} hint="Requests currently in your queue." tone="info" />
        <MetricTile label="Urgent or high" value={urgentHigh} hint="Prioritize these first to keep work moving." tone="warning" />
        <MetricTile label="Oldest request age" value={oldest !== null ? `${oldest}d` : "-"} hint="Age of the oldest pending request." tone="default" />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/20 dark:divide-white/10">
            <caption className="sr-only">Tickets pending approval</caption>
            <thead>
              <tr>
                <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Request ID</th>
                <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Title</th>
                <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Requester</th>
                <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Priority</th>
                <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Updated</th>
                <th scope="col" className="card-header px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20 bg-white/25 dark:bg-white/5">
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyDashboardState title="Nothing is waiting for your approval." description="You are all caught up for this role." />
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id} className="table-row-glass transition-colors">
                    <td className="px-5 py-4 text-sm font-medium text-slate-700 dark:text-slate-200">{ticket.requestId ?? "-"}</td>
                    <td className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100">{ticket.title}</td>
                    <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{ticket.requester.email}</td>
                    <td className="px-5 py-4 text-sm"><PriorityPill priority={ticket.priority as string | null | undefined} /></td>
                    <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-300">{formatShortDate(ticket.updatedAt)}</td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/requests/${ticket.id}`} className="btn-primary inline-flex py-2 text-sm dark:text-white">
                        Review
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <details className="card overflow-hidden">
        <summary className="card-header cursor-pointer px-5 py-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
          Approval history ({historyTickets.length})
        </summary>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/20 dark:divide-white/10">
            <caption className="sr-only">Tickets approved or rejected by this user</caption>
            <thead>
              <tr>
                <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Request ID</th>
                <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Title</th>
                <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Action</th>
                <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Requester</th>
                <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Action date</th>
                <th scope="col" className="card-header px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20 bg-white/25 dark:bg-white/5">
              {historyTickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyDashboardState title="No approval history yet." description="Approved and rejected tickets will appear here after you take action." />
                  </td>
                </tr>
              ) : (
                historyTickets.map((ticket) => (
                  <tr key={`${ticket.id}-${ticket.approvalAt}`} className="table-row-glass transition-colors">
                    <td className="px-5 py-4 text-sm font-medium text-slate-700 dark:text-slate-200">{ticket.requestId ?? "-"}</td>
                    <td className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100">{ticket.title}</td>
                    <td className="px-5 py-4 text-sm capitalize text-slate-700 dark:text-slate-200">{ticket.approvalAction}</td>
                    <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{ticket.requester.email}</td>
                    <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-300">{formatShortDate(ticket.approvalAt)}</td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/requests/${ticket.id}`} className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-sky-200 dark:hover:text-white">
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
