"use client";

import Link from "next/link";
import { Ticket, User } from "@prisma/client";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { STATUS_LABELS } from "@/lib/constants";

type TicketWithRequester = Ticket & { requester?: User };

export function RequesterDashboard({
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
  /** When true, show "New request" button (e.g. for Super Admin). When undefined, show when !showAll. */
  showNewRequestButton?: boolean;
}) {
  const colSpan = showAll ? 7 : 6;
  const heading = title ?? (showAll ? "All Requests" : "My Requests");
  const sub = subtitle ?? (showAll ? "All procurement tickets." : "View and manage your purchase requests.");
  const showButton = showNewRequestButton ?? !showAll;
  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{heading}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-200">{sub}</p>
        </div>
        {showButton && (
          <Link href="/requests/new" className="btn-primary flex items-center gap-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New request
          </Link>
        )}
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/20 dark:divide-white/10">
            <thead>
              <tr>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Title</th>
                {showAll && <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Requester</th>}
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Team</th>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Status</th>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Updated</th>
                <th className="card-header px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20 bg-white/25 dark:bg-white/5">
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-5 py-12 text-center">
                    <p className="text-slate-500 dark:text-slate-300">No requests yet.</p>
                    {showButton && (
                      <Link href="/requests/new" className="btn-primary mt-4 inline-flex">Create your first request</Link>
                    )}
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.id} className="table-row-glass transition-colors">
                    <td className="px-5 py-4 text-sm font-medium text-slate-700 dark:text-slate-200">{t.requestId ?? "—"}</td>
                    <td className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100">{t.title}</td>
                    {showAll && <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{t.requester?.email ?? "—"}</td>}
                    <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{t.teamName}</td>
                    <td className="px-5 py-4"><StatusBadge status={t.status} /></td>
                    <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-300">
                      {new Date(t.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link href={"/requests/" + t.id} className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-sky-200 dark:hover:text-white">View →</Link>
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
