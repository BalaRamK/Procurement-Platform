"use client";

import Link from "next/link";
import { Ticket, User } from "@prisma/client";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { STATUS_LABELS } from "@/lib/constants";

type TicketWithRequester = Ticket & { requester: User };

export function ProductionDashboard({
  tickets,
  title,
  subtitle,
}: {
  tickets: TicketWithRequester[];
  title?: string;
  subtitle?: string;
}) {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{title ?? "Assigned to production"}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {subtitle ?? "Tickets assigned to your team for fulfillment. Mark as delivered when material is sent."}
        </p>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/20">
            <thead>
              <tr>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Title</th>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Requester</th>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Item / Qty</th>
                <th className="card-header px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20 bg-white/25">
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    No tickets assigned to production.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t.id} className="table-row-glass transition-colors">
                    <td className="px-5 py-4 font-medium text-slate-900">{t.title}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{t.requester.email}</td>
                    <td className="px-5 py-4"><StatusBadge status={t.status} /></td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {t.itemName ?? t.componentDescription ?? "—"} {t.quantity != null ? `× ${t.quantity}` : ""}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link href={"/requests/" + t.id} className="text-sm font-medium text-primary-600 hover:text-primary-700">View →</Link>
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
