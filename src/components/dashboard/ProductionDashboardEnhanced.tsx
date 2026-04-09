"use client";

import Link from "next/link";
import type { Ticket, User } from "@/types/db";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DashboardHero, EmptyDashboardState, MetricTile, formatShortDate } from "./DashboardShared";

type TicketWithRequester = Ticket & { requester: User };

function daysSince(date: string | Date) {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

export function ProductionDashboardEnhanced({
  tickets,
  title,
  subtitle,
}: {
  tickets: TicketWithRequester[];
  title?: string;
  subtitle?: string;
}) {
  const assignedCount = tickets.filter((ticket) => ticket.status === "ASSIGNED_TO_PRODUCTION").length;
  const deliveredCount = tickets.filter((ticket) => ticket.status === "DELIVERED_TO_REQUESTER").length;
  const oldest = tickets.length > 0 ? Math.max(...tickets.map((ticket) => daysSince(ticket.createdAt as string | Date))) : null;

  return (
    <div className="space-y-6">
      <DashboardHero
        eyebrow="Procurement queue"
        title={title ?? "Assigned to procurement"}
        description={subtitle ?? "Track what needs sourcing or delivery, then mark requests as delivered once material has been sent."}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricTile label="Awaiting delivery" value={assignedCount} hint="Requests that still need fulfillment." tone="info" />
        <MetricTile label="Delivered" value={deliveredCount} hint="Sent to requester and waiting for confirmation." tone="success" />
        <MetricTile label="Oldest request age" value={oldest !== null ? `${oldest}d` : "-"} hint="Age of the oldest request in this queue." tone="warning" />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/20 dark:divide-white/10">
            <caption className="sr-only">Tickets assigned to procurement</caption>
            <thead>
              <tr>
                <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Request ID</th>
                <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Title</th>
                <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Requester</th>
                <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Item / Qty</th>
                <th scope="col" className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Updated</th>
                <th scope="col" className="card-header px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20 bg-white/25 dark:bg-white/5">
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <EmptyDashboardState title="No requests are assigned right now." description="New procurement work will appear here automatically." />
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id} className="table-row-glass transition-colors">
                    <td className="px-5 py-4 text-sm font-medium text-slate-700 dark:text-slate-200">{ticket.requestId ?? "-"}</td>
                    <td className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100">{ticket.title}</td>
                    <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{ticket.requester.email}</td>
                    <td className="px-5 py-4"><StatusBadge status={ticket.status} /></td>
                    <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {ticket.itemName ?? ticket.componentDescription ?? "-"}
                      {ticket.quantity != null ? ` x ${ticket.quantity}` : ""}
                    </td>
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
