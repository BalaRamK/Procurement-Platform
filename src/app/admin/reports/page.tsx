import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { STATUS_LABELS } from "@/lib/constants";
import type { TicketStatus } from "@prisma/client";

const LIFECYCLE_ORDER: TicketStatus[] = [
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
];

export default async function AdminReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  const tickets = await prisma.ticket.findMany({
    include: { requester: true },
    orderBy: { updatedAt: "desc" },
  });

  const byStatus = LIFECYCLE_ORDER.reduce(
    (acc, status) => {
      acc[status] = tickets.filter((t) => t.status === status).length;
      return acc;
    },
    {} as Record<TicketStatus, number>
  );

  const total = tickets.length;
  const closedOrRejected = (byStatus.CLOSED ?? 0) + (byStatus.REJECTED ?? 0);
  const inProgress = total - (byStatus.DRAFT ?? 0) - closedOrRejected;

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Back to User management
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Reports & SLA</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ticket lifecycle and status counts. Configure workflows and SLAs from here (Admin).
        </p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm font-medium text-slate-500">Total tickets</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{total}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-slate-500">In progress</p>
          <p className="mt-1 text-2xl font-bold text-primary-600">{inProgress}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm font-medium text-slate-500">Closed / Rejected</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{closedOrRejected}</p>
        </div>
      </div>

      <div className="card overflow-hidden mb-8">
        <div className="card-header border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">SLA & workflow configuration</h2>
          <p className="mt-1 text-sm text-slate-500">Target response times and escalation rules (configure here).</p>
        </div>
        <div className="px-6 py-5">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="glass-panel p-4">
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">FH approval target</dt>
              <dd className="mt-1 text-lg font-semibold text-slate-900">24 hours</dd>
              <p className="mt-1 text-xs text-slate-500">Placeholder — configurable later</p>
            </div>
            <div className="glass-panel p-4">
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">L1 approval target</dt>
              <dd className="mt-1 text-lg font-semibold text-slate-900">24 hours</dd>
              <p className="mt-1 text-xs text-slate-500">Placeholder — configurable later</p>
            </div>
            <div className="glass-panel p-4">
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Finance / CDO target</dt>
              <dd className="mt-1 text-lg font-semibold text-slate-900">48 hours</dd>
              <p className="mt-1 text-xs text-slate-500">Placeholder — configurable later</p>
            </div>
          </dl>
          <p className="mt-4 text-sm text-slate-500">Escalation and email reminders can be wired to these targets.</p>
        </div>
      </div>

      <div className="card overflow-hidden mb-8">
        <div className="card-header border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Tickets by status (lifecycle)</h2>
          <p className="mt-1 text-sm text-slate-500">Open → Pending FH → Pending L1 → Pending CFO → Pending CDO → Assigned to Production → Delivered → Confirmed → Closed.</p>
        </div>
        <dl className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3">
          {LIFECYCLE_ORDER.map((status) => (
            <div key={status} className="border-b border-white/20 px-6 py-4 sm:border-r sm:border-r-white/20 even:sm:border-r-0">
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">{STATUS_LABELS[status] ?? status}</dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">{byStatus[status] ?? 0}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="card overflow-hidden">
        <div className="card-header border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Recent tickets</h2>
          <p className="mt-1 text-sm text-slate-500">All tickets by last updated.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/20">
            <thead>
              <tr>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Title</th>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Requester</th>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Updated</th>
                <th className="card-header px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20 bg-white/25">
              {tickets.slice(0, 50).map((t) => (
                <tr key={t.id} className="table-row-glass transition-colors">
                  <td className="px-5 py-4 font-medium text-slate-900">{t.title}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">{t.requester.email}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">
                    {new Date(t.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link href={"/requests/" + t.id} className="text-sm font-medium text-primary-600 hover:text-primary-700">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tickets.length > 50 && (
          <div className="card-header border-t border-white/25 px-6 py-3 text-sm text-slate-500">
            Showing 50 of {tickets.length} tickets.
          </div>
        )}
      </div>
    </div>
  );
}
