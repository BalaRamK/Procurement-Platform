"use client";

import Link from "next/link";
import { Ticket, User } from "@prisma/client";
import { TeamName } from "@prisma/client";
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
  role: string;
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
        <h1 className="text-2xl font-bold text-slate-900">{heading}</h1>
        <p className="mt-1 text-sm text-slate-500">{sub}</p>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/20">
            <thead>
              <tr>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Title</th>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Requester</th>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Team</th>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Updated</th>
                <th className="card-header px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20 bg-white/25">
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    No tickets in your queue right now.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.id} className="table-row-glass transition-colors">
                    <td className="px-5 py-4 font-medium text-slate-900">{t.title}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{t.requester.email}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{t.teamName}</td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {new Date(t.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link href={"/requests/" + t.id} className="btn-primary inline-flex py-2 text-sm">Review</Link>
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
