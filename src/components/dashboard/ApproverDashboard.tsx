"use client";

import Link from "next/link";
import type { Ticket, User, UserRole, TeamName } from "@/types/db";
import { ROLE_LABELS } from "@/lib/constants";

type TicketWithRequester = Ticket & { requester: User };

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
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{heading}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-200">{sub}</p>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/20 dark:divide-white/10">
            <thead>
              <tr>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Request ID</th>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Title</th>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Requester</th>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Team</th>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Updated</th>
                <th className="card-header px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20 bg-white/25 dark:bg-white/5">
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500 dark:text-slate-300">
                    No tickets in your queue right now.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.id} className="table-row-glass transition-colors">
                    <td className="px-5 py-4 text-sm font-medium text-slate-700 dark:text-slate-200">{t.requestId ?? "—"}</td>
                    <td className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100">{t.title}</td>
                    <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{t.requester.email}</td>
                    <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{t.teamName}</td>
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
