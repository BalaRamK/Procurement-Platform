"use client";

import Link from "next/link";
import type { Ticket, User } from "@/types/db";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DashboardHero, EmptyDashboardState, MetricTile, formatShortDate } from "./DashboardShared";

type TicketWithRequester = Ticket & { requester?: User };

export function RequesterDashboardEnhanced({
  tickets,
  showAll = false,
  title,
  subtitle,
  showNewRequestButton,
}: {
  tickets: TicketWithRequester[];
  showAll?: boolean;
  title?: string;
  subtitle?: string;
  showNewRequestButton?: boolean;
}) {
  const colSpan = showAll ? 7 : 6;
  const heading = title ?? (showAll ? "All requests" : "My requests");
  const sub = subtitle ?? (showAll ? "Browse the full procurement queue across teams." : "Track what you have raised and what still needs your attention.");
  const showButton = showNewRequestButton ?? !showAll;
  const openCount = tickets.filter((ticket) => ticket.status !== "CLOSED" && ticket.status !== "REJECTED").length;
  const waitingConfirm = tickets.filter((ticket) => ticket.status === "DELIVERED_TO_REQUESTER").length;
  const recentUpdate = tickets.length > 0 ? formatShortDate(tickets[0].updatedAt) : "-";

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow={showAll ? "Operations view" : "Requester workspace"}
        title={heading}
        description={sub}
        action={
          showButton ? (
            <Link href="/requests/new" className="btn-primary flex items-center gap-2">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New request
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricTile label="Visible requests" value={tickets.length} hint="Items currently in this view." tone="info" />
        <MetricTile label="Open work" value={openCount} hint="Requests still moving through the process." tone="warning" />
        <MetricTile label="Latest update" value={recentUpdate} hint="Most recent activity in the current list." tone="default" />
      </div>

      {waitingConfirm > 0 ? (
        <div className="rounded-3xl border border-amber-300/40 bg-amber-50/80 px-5 py-4 text-sm text-amber-900 shadow-sm dark:border-amber-500/20 dark:bg-amber-950/20 dark:text-amber-200">
          {waitingConfirm} request{waitingConfirm === 1 ? "" : "s"} are waiting for requester confirmation.
        </div>
      ) : null}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/20 dark:divide-white/10">
            <caption className="sr-only">{heading}</caption>
            <thead>
              <tr>
                <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">ID</th>
                <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Title</th>
                {showAll ? <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Requester</th> : null}
                <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Team</th>
                <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Status</th>
                <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Updated</th>
                <th scope="col" className="card-header px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20 bg-white/25 dark:bg-white/5">
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="p-0">
                    <EmptyDashboardState
                      title={showAll ? "No requests have been submitted yet." : "You have not submitted any requests yet."}
                      description={showAll ? "Requests will appear here once teams start using the platform." : "Create your first request to start the approval workflow."}
                      actionHref={showButton ? "/requests/new" : undefined}
                      actionLabel={showButton ? "Create your first request" : undefined}
                    />
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id} className="table-row-glass transition-colors">
                    <td className="px-5 py-4 text-sm font-medium text-slate-700 dark:text-slate-200">{ticket.requestId ?? "-"}</td>
                    <td className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100">{ticket.title}</td>
                    {showAll ? <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{ticket.requester?.email ?? "-"}</td> : null}
                    <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{ticket.teamName}</td>
                    <td className="px-5 py-4"><StatusBadge status={ticket.status} /></td>
                    <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-300">{formatShortDate(ticket.updatedAt)}</td>
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
      </div>
    </div>
  );
}
