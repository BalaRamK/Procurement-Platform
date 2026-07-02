import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { STATUS_LABELS } from "@/lib/constants";
import { OpenTicketsReportDownload } from "@/components/admin/OpenTicketsReportDownload";
import { OPEN_TICKET_REPORT_HEADERS, OPEN_TICKET_REPORT_SQL, toOpenTicketReportRows, type OpenTicketReportSource } from "@/lib/open-ticket-report";
import { formatBytes, getAttachmentStorageUsage } from "@/lib/attachments";
import { APPROVAL_SLA_SQL, formatApprovalDuration, normalizeApprovalSlaRows, type ApprovalSlaRow } from "@/lib/approval-sla";

const LIFECYCLE_ORDER = [
  "DRAFT",
  "PENDING_L1_APPROVAL",
  "PENDING_FH_APPROVAL",
  "PENDING_FINANCE_APPROVAL",
  "PENDING_CFO_APPROVAL",
  "PENDING_CDO_APPROVAL",
  "ASSIGNED_TO_PRODUCTION",
  "ORDER_PLACED",
  "DELIVERED_TO_REQUESTER",
  "CONFIRMED_BY_REQUESTER",
  "CLOSED",
  "REJECTED",
] as const;

type StatusKey = (typeof LIFECYCLE_ORDER)[number];

export default async function AdminReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  if (!session.user.roles?.includes("SUPER_ADMIN")) redirect("/dashboard");

  const tickets = await query<Record<string, unknown>>(
    `SELECT t.id, t.title, t.status, t.updated_at AS "updatedAt", t.request_id AS "requestId", u.email AS "requesterEmail"
     FROM tickets t LEFT JOIN users u ON t.requester_id = u.id ORDER BY t.updated_at DESC`
  );

  const openTicketReportSource = await query<OpenTicketReportSource>(OPEN_TICKET_REPORT_SQL);
  const openTicketReportRows = toOpenTicketReportRows(openTicketReportSource);
  const attachmentStorage = await getAttachmentStorageUsage();
  const approvalSlaRows = normalizeApprovalSlaRows(await query<ApprovalSlaRow>(APPROVAL_SLA_SQL));

  const byStatus = LIFECYCLE_ORDER.reduce(
    (acc, status) => {
      acc[status] = tickets.filter((t: Record<string, unknown>) => t.status === status).length;
      return acc;
    },
    {} as Record<StatusKey, number>
  );

  const total = tickets.length;
  const closedOrRejected = (byStatus.CLOSED ?? 0) + (byStatus.REJECTED ?? 0);
  const inProgress = total - (byStatus.DRAFT ?? 0) - closedOrRejected;

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white">
          ← Back to User management
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reports & SLA</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-200">
          Ticket lifecycle and status counts. Configure workflows and SLAs from here (Admin).
        </p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5 dark:bg-[#171717]">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-300">Total tickets</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{total}</p>
        </div>
        <div className="card p-5 dark:bg-[#171717]">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-300">In progress</p>
          <p className="mt-1 text-2xl font-bold text-primary-600 dark:text-sky-200">{inProgress}</p>
        </div>
        <div className="card p-5 dark:bg-[#171717]">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-300">Closed / Rejected</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{closedOrRejected}</p>
        </div>
        <div className="card p-5 dark:bg-[#171717]">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-300">Attachment storage</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{formatBytes(attachmentStorage.bytes)}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{attachmentStorage.files} files on VM</p>
        </div>
      </div>

      <div className="card overflow-hidden mb-8 dark:bg-[#171717] dark:border-white/10">
        <div className="card-header border-b px-6 py-4 dark:bg-[#1f1f1f] dark:border-white/10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Average approval time by level</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-200">Average time taken from the previous workflow handoff to approval at each level.</p>
        </div>
        <dl className="grid gap-0 sm:grid-cols-2 lg:grid-cols-5 dark:bg-[#171717]">
          {approvalSlaRows.map((row) => (
            <div key={row.key} className="border-b border-white/20 px-6 py-4 dark:border-white/10 sm:border-r sm:border-r-white/20 dark:sm:border-r-white/10">
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300">{row.label}</dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{formatApprovalDuration(row.averageHours)}</dd>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{row.completedCount} approvals measured</p>
            </div>
          ))}
        </dl>
      </div>

      <div className="card overflow-hidden mb-8 dark:bg-[#171717] dark:border-white/10">
        <div className="card-header border-b px-6 py-4 dark:bg-[#1f1f1f] dark:border-white/10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">SLA & workflow configuration</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-200">Target response times and escalation rules (configure here).</p>
        </div>
        <div className="px-6 py-5">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="glass-panel p-4 dark:bg-[#1f1f1f] dark:border-white/10">
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300">FH approval target</dt>
              <dd className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">24 hours</dd>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Placeholder — configurable later</p>
            </div>
            <div className="glass-panel p-4 dark:bg-[#1f1f1f] dark:border-white/10">
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300">L1 approval target</dt>
              <dd className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">24 hours</dd>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Placeholder — configurable later</p>
            </div>
            <div className="glass-panel p-4 dark:bg-[#1f1f1f] dark:border-white/10">
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300">Finance / CDO target</dt>
              <dd className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">48 hours</dd>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Placeholder — configurable later</p>
            </div>
          </dl>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-200">Escalation and email reminders can be wired to these targets.</p>
        </div>
      </div>

      <div className="card overflow-hidden mb-8 dark:bg-[#171717] dark:border-white/10">
        <div className="card-header border-b px-6 py-4 dark:bg-[#1f1f1f] dark:border-white/10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tickets by status (lifecycle)</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-200">Open &gt; Pending L1 &gt; Pending Department Head &gt; Finance Approval if needed &gt; Pending CFO &gt; Pending CDO &gt; Assigned to Production &gt; Order Placed &gt; Delivered &gt; Confirmed &gt; Closed.</p>
        </div>
        <dl className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3 dark:bg-[#171717]">
          {LIFECYCLE_ORDER.map((status) => (
            <div key={status} className="border-b border-white/20 dark:border-white/10 dark:bg-[#171717] px-6 py-4 sm:border-r sm:border-r-white/20 even:sm:border-r-0 dark:sm:border-r-white/10">
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300">{STATUS_LABELS[status] ?? status}</dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{byStatus[status] ?? 0}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="card mb-8 overflow-hidden dark:bg-[#171717] dark:border-white/10">
        <div className="card-header flex flex-col gap-3 border-b px-6 py-4 dark:bg-[#1f1f1f] dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Open tickets report</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-200">Open requests with owner, item, and pending-with details.</p>
          </div>
          <OpenTicketsReportDownload rows={openTicketReportRows} />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <caption className="sr-only">Open tickets report</caption>
            <thead>
              <tr className="bg-orange-50 dark:bg-[#1f1f1f]">
                {OPEN_TICKET_REPORT_HEADERS.map((header) => (
                  <th key={header} scope="col" className="whitespace-nowrap border border-slate-300 px-3 py-2 text-left font-semibold text-slate-950 dark:border-slate-600 dark:text-slate-100">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {openTicketReportRows.length === 0 ? (
                <tr>
                  <td colSpan={OPEN_TICKET_REPORT_HEADERS.length} className="border border-slate-300 px-3 py-8 text-center text-slate-500 dark:border-slate-600 dark:text-slate-300">
                    No open tickets.
                  </td>
                </tr>
              ) : (
                openTicketReportRows.map((row) => (
                  <tr key={`${row.requestId}-${row.slNo}`} className="bg-white/40 dark:bg-white/5">
                    <td className="border border-slate-300 px-3 py-2 align-top dark:border-slate-600">{row.slNo}</td>
                    <td className="border border-slate-300 px-3 py-2 align-top font-medium text-primary-700 dark:border-slate-600 dark:text-sky-200">{row.requestId}</td>
                    <td className="border border-slate-300 px-3 py-2 align-top dark:border-slate-600">{row.requesterName}</td>
                    <td className="border border-slate-300 px-3 py-2 align-top dark:border-slate-600">{row.team}</td>
                    <td className="border border-slate-300 px-3 py-2 align-top dark:border-slate-600">{row.createdOn}</td>
                    <td className="min-w-[16rem] border border-slate-300 px-3 py-2 align-top dark:border-slate-600">{row.ticketTitle}</td>
                    <td className="min-w-[22rem] border border-slate-300 px-3 py-2 align-top dark:border-slate-600">{row.item}</td>
                    <td className="min-w-[14rem] border border-slate-300 px-3 py-2 align-top dark:border-slate-600">{row.pendingWith}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card overflow-hidden dark:bg-[#171717] dark:border-white/10">
        <div className="card-header border-b px-6 py-4 dark:bg-[#1f1f1f] dark:border-white/10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent tickets</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-200">All tickets by last updated.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/20 dark:divide-white/10">
            <thead>
              <tr>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Title</th>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Requester</th>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Status</th>
                <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Updated</th>
                <th className="card-header px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20 bg-white/25 dark:bg-white/5">
              {tickets.slice(0, 50).map((t: Record<string, unknown>) => (
                <tr key={String(t.id)} className="table-row-glass transition-colors">
                  <td className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100">{String(t.title)}</td>
                  <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{String(t.requesterEmail ?? "—")}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={String(t.status)} />
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-300">
                    {t.updatedAt ? new Date(t.updatedAt as string).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link href={"/requests/" + t.id} className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-sky-200 dark:hover:text-white">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tickets.length > 50 && (
          <div className="card-header border-t border-white/25 px-6 py-3 text-sm text-slate-500 dark:text-slate-300">
            Showing 50 of {tickets.length} tickets.
          </div>
        )}
      </div>
    </div>
  );
}
