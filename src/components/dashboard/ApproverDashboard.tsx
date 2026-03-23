"use client";

import Link from "next/link";
import type { Ticket, User, UserRole, TeamName } from "@/types/db";
import { ROLE_LABELS } from "@/lib/constants";

type TicketWithRequester = Ticket & { requester: User };

function daysSince(date: string | Date) {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

export function ApproverDashboard({
  tickets,
  role,
  teamName,
  title,
  subtitle,
}: {
  tickets: TicketWithRequester[];
  role: UserRole;
  teamName?: TeamName | null;
  title?: string;
  subtitle?: string;
}) {
  const defaultSub = teamName
    ? `${ROLE_LABELS[role] ?? role} (${teamName})`
    : (ROLE_LABELS[role] ?? role);
  const heading = title ?? "Action required";
  const sub = subtitle ?? `Tickets waiting for your approval (${defaultSub}).`;

  const urgentHigh = tickets.filter((t) => t.priority === "URGENT" || t.priority === "HIGH").length;
  const oldest = tickets.length > 0
    ? Math.max(...tickets.map((t) => daysSince(t.createdAt)))
    : null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{heading}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-200">{sub}</p>
      </div>

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card flex items-center gap-4 px-5 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/40">
            <svg className="h-5 w-5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{tickets.length}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Pending approval</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 px-5 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-900/40">
            <svg className="h-5 w-5 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{urgentHigh}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Urgent / High priority</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 px-5 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
            <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {oldest !== null ? `${oldest}d` : "—"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Oldest request age</p>
          </div>
        </div>
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
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
                        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="font-medium text-slate-700 dark:text-slate-200">Nothing is waiting for your approval.</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">You&apos;re all caught up!</p>
                    </div>
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.id} className="table-row-glass transition-colors">
                    <td className="px-5 py-4 text-sm font-medium text-slate-700 dark:text-slate-200">{t.requestId ?? "—"}</td>
                    <td className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100">{t.title}</td>
                    <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{t.requester.email}</td>
                    <td className="px-5 py-4 text-sm">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.priority === "URGENT" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" :
                        t.priority === "HIGH" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" :
                        t.priority === "MEDIUM" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" :
                        "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      }`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-300">
                      {new Date(t.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link href={"/requests/" + t.id} className="btn-primary inline-flex py-2 text-sm dark:text-white">Review</Link>
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
