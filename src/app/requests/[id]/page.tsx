import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TicketActions } from "@/components/requests/TicketActions";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TicketComments } from "@/components/requests/TicketComments";
import { PageHeader } from "@/components/layout/PageHeader";
import { TeamName } from "@prisma/client";
import { STATUS_LABELS } from "@/lib/constants";

function canView(
  role: string,
  userTeam: TeamName | null,
  ticket: { requesterId: string; status: string; teamName: TeamName }
) {
  if (role === "SUPER_ADMIN") return true;
  if (ticket.requesterId && role === "REQUESTER") return true;
  if (role === "PRODUCTION" && (ticket.status === "ASSIGNED_TO_PRODUCTION" || ticket.status === "DELIVERED_TO_REQUESTER")) return true;
  if (role === "FUNCTIONAL_HEAD" && userTeam === ticket.teamName && ticket.status === "PENDING_FH_APPROVAL") return true;
  if (role === "L1_APPROVER" && userTeam === ticket.teamName && ticket.status === "PENDING_L1_APPROVAL") return true;
  if (role === "CFO" && ticket.status === "PENDING_CFO_APPROVAL") return true;
  if (role === "CDO" && ticket.status === "PENDING_CDO_APPROVAL") return true;
  return false;
}

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { requester: true },
  });
  if (!ticket) notFound();

  const role = session.user.role ?? "REQUESTER";
  const userTeam = session.user.team ?? null;
  const isRequester = ticket.requesterId === session.user.id;
  const isProduction = role === "PRODUCTION";
  const canShowActions =
    (isRequester && (ticket.status === "DRAFT" || ticket.status === "DELIVERED_TO_REQUESTER")) ||
    (isProduction && ticket.status === "ASSIGNED_TO_PRODUCTION") ||
    (role === "FUNCTIONAL_HEAD" && userTeam === ticket.teamName && ticket.status === "PENDING_FH_APPROVAL") ||
    (role === "L1_APPROVER" && userTeam === ticket.teamName && ticket.status === "PENDING_L1_APPROVAL") ||
    (role === "CFO" && ticket.status === "PENDING_CFO_APPROVAL") ||
    (role === "CDO" && ticket.status === "PENDING_CDO_APPROVAL");

  if (!canView(role, userTeam, ticket) && !isRequester) redirect("/dashboard");

  const fields: { label: string; value: string | number | null | undefined }[] = [
    { label: "Request ID", value: ticket.requestId ?? undefined },
    { label: "Requester", value: ticket.requesterName },
    { label: "Department", value: ticket.department },
    { label: "Team (Request type)", value: ticket.teamName },
    { label: "Priority", value: ticket.priority },
    { label: "Created", value: new Date(ticket.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) },
    { label: "Item description", value: ticket.description ?? undefined },
    { label: "Component description", value: ticket.componentDescription ?? undefined },
    { label: "BOM / Product ID", value: ticket.bomId ?? ticket.productId ?? undefined },
    { label: "Project / Customer", value: ticket.projectCustomer ?? undefined },
    { label: "Need by date", value: ticket.needByDate ? new Date(ticket.needByDate).toLocaleDateString() : undefined },
    { label: "Charge code", value: ticket.chargeCode ?? undefined },
    { label: "Cost", value: ticket.estimatedCost != null ? `${String(ticket.estimatedCost)} ${ticket.costCurrency ?? ""}` : (ticket.rate != null ? `${String(ticket.rate)} ${ticket.unit ?? ""}` : undefined) },
    { label: "Estimated PO date", value: ticket.estimatedPODate ? new Date(ticket.estimatedPODate).toLocaleDateString() : undefined },
    { label: "Place of delivery", value: ticket.placeOfDelivery ?? undefined },
    { label: "Quantity", value: ticket.quantity ?? undefined },
    { label: "Deal name", value: ticket.dealName ?? undefined },
  ].filter((f) => f.value != null && f.value !== "");

  return (
    <div className="space-y-6">
      <PageHeader backHref="/dashboard" backLabel="Back to Dashboard" />
      <div className="card overflow-hidden">
        <div className="card-header border-b px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{ticket.title}</h1>
              {ticket.requestId && (
                <p className="mt-0.5 text-sm font-medium text-slate-500 dark:text-slate-400">Request ID: {ticket.requestId}</p>
              )}
            </div>
            <StatusBadge status={ticket.status} />
          </div>
          {ticket.description && <p className="mt-2 text-sm text-slate-600 dark:text-slate-200">{ticket.description}</p>}
        </div>
        <dl className="grid gap-0 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.label} className="border-b border-white/20 px-6 py-4 sm:border-r sm:border-r-white/20 even:sm:border-r-0">
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-300">{f.label}</dt>
              <dd className="mt-1 text-sm text-slate-900 dark:text-slate-100">{String(f.value)}</dd>
            </div>
          ))}
        </dl>
        {ticket.status === "REJECTED" && ticket.rejectionRemarks && (
          <div className="card-header border-t border-red-200/40 bg-red-400/10 px-6 py-4">
            <dt className="text-xs font-medium uppercase tracking-wider text-red-700">Rejection remarks</dt>
            <dd className="mt-1 text-sm text-red-900">{ticket.rejectionRemarks}</dd>
          </div>
        )}
        {canShowActions && (
          <div className="card-header border-t border-white/25 px-6 py-5">
            <TicketActions ticketId={ticket.id} status={ticket.status} isRequester={isRequester} isProduction={isProduction} />
          </div>
        )}
      </div>
      <div className="mt-8">
        <TicketComments ticketId={ticket.id} />
      </div>
    </div>
  );
}
