import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import type { ReactNode } from "react";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { TicketActions } from "@/components/requests/TicketActions";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TicketComments } from "@/components/requests/TicketComments";
import { PageHeader } from "@/components/layout/PageHeader";
import { WorkflowStepper } from "@/components/ui/WorkflowStepper";
import type { TeamName, UserRole } from "@/types/db";
import { hasRole } from "@/types/db";

function canView(
  roles: UserRole[] | null | undefined,
  userTeam: TeamName | null,
  ticket: { requesterId: string; status: string; teamName: TeamName },
  currentUserId?: string
) {
  if (hasRole(roles, "SUPER_ADMIN")) return true;
  if (currentUserId && ticket.requesterId === currentUserId && hasRole(roles, "REQUESTER")) return true;
  if (hasRole(roles, "PRODUCTION") && (ticket.status === "ASSIGNED_TO_PRODUCTION" || ticket.status === "DELIVERED_TO_REQUESTER")) return true;
  if (hasRole(roles, "FUNCTIONAL_HEAD") && userTeam === ticket.teamName && ticket.status === "PENDING_FH_APPROVAL") return true;
  if (hasRole(roles, "L1_APPROVER") && userTeam === ticket.teamName && ticket.status === "PENDING_L1_APPROVAL") return true;
  if (hasRole(roles, "CFO") && ticket.status === "PENDING_CFO_APPROVAL") return true;
  if (hasRole(roles, "CDO") && ticket.status === "PENDING_CDO_APPROVAL") return true;
  return false;
}

function DetailCard({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      <div className="card-header border-b border-white/20 px-6 py-4 dark:border-white/10">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/25 px-4 py-3 shadow-[var(--glass-inner)] dark:border-white/10 dark:bg-white/5">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
        {value}
      </dd>
    </div>
  );
}

function formatDate(value: string | number | null | undefined) {
  if (value == null || value === "") return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatDateOnly(value: string | number | null | undefined) {
  if (value == null || value === "") return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function toText(value: unknown) {
  if (value == null || value === "") return "—";
  return String(value);
}

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  const { id } = await params;
  const rows = await query<Record<string, unknown>>(
    `SELECT t.id, t.request_id AS "requestId", t.title, t.description, t.requester_name AS "requesterName",
     t.department, t.component_description AS "componentDescription", t.item_name AS "itemName",
     t.brand_name_company AS "brandNameCompany", t.preferred_supplier AS "preferredSupplier",
     t.country_of_origin AS "countryOfOrigin", t.team_name AS "teamName", t.priority, t.status,
     t.rejection_remarks AS "rejectionRemarks", t.requester_id AS "requesterId",
     t.need_by_date AS "needByDate", t.charge_code AS "chargeCode", t.estimated_cost AS "estimatedCost",
     t.cost_currency AS "costCurrency", t.rate, t.unit, t.estimated_po_date AS "estimatedPoDate",
     t.place_of_delivery AS "placeOfDelivery", t.quantity, t.deal_name AS "dealName", t.bom_id AS "bomId", t.product_id AS "productId",
     t.project_customer AS "projectCustomer", t.created_at AS "createdAt", t.delivered_at AS "deliveredAt", t.updated_at AS "updatedAt",
     u.id AS "rId", u.email AS "rEmail", u.name AS "rName"
     FROM tickets t LEFT JOIN users u ON t.requester_id = u.id WHERE t.id = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) notFound();

  const lineRows = await query<Record<string, unknown>>(
    `SELECT sort_order AS "sortOrder", component_name AS "componentName", bom_id AS "bomId",
     cost_per_item AS "costPerItem", quantity, item_description AS "itemDescription", zoho_available AS "zohoAvailable"
     FROM ticket_line_items WHERE ticket_id = $1 ORDER BY sort_order ASC`,
    [id]
  );

  const ticketRaw = {
    ...row,
    requester: row.rId != null ? { id: row.rId, email: row.rEmail, name: row.rName } : null,
  } as Record<string, unknown>;
  delete ticketRaw.rId;
  delete ticketRaw.rEmail;
  delete ticketRaw.rName;
  type TicketDetail = {
    requesterId: string;
    status: string;
    teamName: TeamName;
    title: string;
    id: string;
    requestId?: string;
    requesterName: string;
    department: string;
    description?: string;
    componentDescription?: string;
    itemName?: string;
    brandNameCompany?: string;
    preferredSupplier?: string;
    countryOfOrigin?: string;
    priority: string;
    rejectionRemarks?: string;
    needByDate?: string;
    chargeCode?: string;
    estimatedCost?: string | number;
    costCurrency?: string;
    rate?: string | number;
    unit?: string;
    estimatedPoDate?: string | null;
    placeOfDelivery?: string;
    quantity?: number;
    dealName?: string;
    bomId?: string;
    productId?: string;
    projectCustomer?: string;
    createdAt: string;
    updatedAt: string;
    requester: { id: string; email: string; name: string | null } | null;
  };
  const ticket = ticketRaw as TicketDetail;

  const roles = session.user.roles ?? [];
  const userTeam = session.user.team ?? null;
  const isRequester = ticket.requesterId === session.user.id;
  const isProduction = hasRole(roles, "PRODUCTION");
  const canShowActions =
    (isRequester && (ticket.status === "DRAFT" || ticket.status === "DELIVERED_TO_REQUESTER")) ||
    (isProduction && ticket.status === "ASSIGNED_TO_PRODUCTION") ||
    (hasRole(roles, "FUNCTIONAL_HEAD") && userTeam === ticket.teamName && ticket.status === "PENDING_FH_APPROVAL") ||
    (hasRole(roles, "L1_APPROVER") && userTeam === ticket.teamName && ticket.status === "PENDING_L1_APPROVAL") ||
    (hasRole(roles, "CFO") && ticket.status === "PENDING_CFO_APPROVAL") ||
    (hasRole(roles, "CDO") && ticket.status === "PENDING_CDO_APPROVAL");

  if (!canView(roles, userTeam, ticket, session.user.id) && !isRequester) redirect("/dashboard");

  const isRejected = ticket.status === "REJECTED" && !!ticket.rejectionRemarks;
  const costValue =
    ticket.estimatedCost != null
      ? `${String(ticket.estimatedCost)} ${ticket.costCurrency ?? ""}`.trim()
      : ticket.rate != null
        ? `${String(ticket.rate)} ${ticket.unit ?? ""}`.trim()
        : "—";

  const overviewFields = [
    { label: "Request ID", value: ticket.requestId ?? "—" },
    { label: "Requester", value: ticket.requesterName },
    { label: "Requester email", value: ticket.requester?.email ?? "—" },
    { label: "Department", value: ticket.department },
    { label: "Team", value: ticket.teamName },
    { label: "Priority", value: ticket.priority },
    { label: "Created", value: formatDate(ticket.createdAt) },
    { label: "Updated", value: formatDate(ticket.updatedAt) },
  ];

  const itemFields = [
    { label: "Item description", value: ticket.description ?? "—" },
    { label: "Component description", value: ticket.componentDescription ?? "—" },
    { label: "Item name", value: ticket.itemName ?? "—" },
    { label: "Brand name & company", value: ticket.brandNameCompany ?? "—" },
    { label: "Preferred supplier", value: ticket.preferredSupplier ?? "—" },
    { label: "Country of origin", value: ticket.countryOfOrigin ?? "—" },
    { label: "BOM ID", value: ticket.bomId ?? "—" },
    { label: "Product ID", value: ticket.productId ?? "—" },
    { label: "Quantity", value: ticket.quantity ?? "—" },
  ];

  const commercialFields = [
    { label: "Need by date", value: formatDateOnly(ticket.needByDate) },
    { label: "Charge code", value: ticket.chargeCode ?? "—" },
    { label: "Estimated cost", value: costValue },
    { label: "Estimated PO date", value: formatDateOnly(ticket.estimatedPoDate) },
    { label: "Place of delivery", value: ticket.placeOfDelivery ?? "—" },
    { label: "Project / Customer", value: ticket.projectCustomer ?? "—" },
    { label: "Deal name", value: ticket.dealName ?? "—" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader backHref="/dashboard" backLabel="Back to Dashboard" />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <aside className="order-first space-y-4 xl:sticky xl:top-6 xl:order-last xl:self-start">
          <DetailCard title="Next action" description="Primary controls are kept near the top so they are easy to find.">
            {canShowActions ? (
              <TicketActions ticketId={ticket.id} status={ticket.status} isRequester={isRequester} isProduction={isProduction} />
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300">No action is available right now for your role.</p>
            )}
          </DetailCard>

          <DetailCard title="Workflow" description="Current progress through the approval path.">
            <WorkflowStepper status={ticket.status} teamName={ticket.teamName} />
          </DetailCard>

          <DetailCard title="At a glance" description="Quick summary for the current request.">
            <div className="grid gap-3">
              <DetailItem label="Status" value={<StatusBadge status={ticket.status} />} />
              <DetailItem label="Team flow" value={ticket.teamName === "SALES" ? "Requester -> L1 -> CFO -> CDO -> Production" : "Requester -> FH -> L1 -> CFO -> CDO -> Production"} />
              <DetailItem label="Created" value={formatDate(ticket.createdAt)} />
              <DetailItem label="Updated" value={formatDate(ticket.updatedAt)} />
            </div>
          </DetailCard>
        </aside>

        <main className="space-y-6">
          <section className="card overflow-hidden">
            <div className="card-header border-b border-white/20 px-6 py-5 dark:border-white/10">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-300">
                      Request detail
                    </p>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{ticket.title}</h1>
                    <div className="flex flex-wrap gap-2 text-sm text-slate-600 dark:text-slate-300">
                      {ticket.requestId && <span className="rounded-full border border-white/20 bg-white/30 px-3 py-1">Request ID: {ticket.requestId}</span>}
                      <span className="rounded-full border border-white/20 bg-white/30 px-3 py-1">Requester: {ticket.requesterName}</span>
                      <span className="rounded-full border border-white/20 bg-white/30 px-3 py-1">Team: {ticket.teamName}</span>
                    </div>
                  </div>
                  <StatusBadge status={ticket.status} />
                </div>
                {ticket.description && <p className="max-w-4xl text-sm leading-6 text-slate-600 dark:text-slate-200">{ticket.description}</p>}
                {isRejected && (
                  <div className="rounded-2xl border border-red-200/50 bg-red-50/70 px-4 py-3 text-sm text-red-900 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-100">
                    <p className="font-semibold">Rejection remarks</p>
                    <p className="mt-1 leading-6">{ticket.rejectionRemarks}</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <DetailCard title="Request overview" description="Identity, ownership, and timing for the ticket.">
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {overviewFields.map((field) => (
                <DetailItem key={field.label} label={field.label} value={field.value} />
              ))}
            </dl>
          </DetailCard>

          <DetailCard title="Item and supplier" description="The item itself plus the supply chain details attached to it.">
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {itemFields.map((field) => (
                <DetailItem key={field.label} label={field.label} value={field.value} />
              ))}
            </dl>
          </DetailCard>

          <DetailCard title="Commercial and logistics" description="Purchase planning, delivery, and costing details.">
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {commercialFields.map((field) => (
                <DetailItem key={field.label} label={field.label} value={field.value} />
              ))}
            </dl>
          </DetailCard>

          {lineRows.length > 0 && (
            <DetailCard title="Bulk line items" description="Line items added from the bulk upload flow.">
              <div className="space-y-3 lg:hidden">
                {lineRows.map((li, i) => (
                  <div key={i} className="rounded-2xl border border-white/20 bg-white/25 p-4 shadow-[var(--glass-inner)] dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {Number(li.sortOrder ?? i) + 1}. {String(li.componentName ?? "") || "Component"}
                      </p>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {li.zohoAvailable === true ? "Available" : li.zohoAvailable === false ? "Not available" : "Unknown"}
                      </span>
                    </div>
                    <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                      <DetailItem label="BOM ID" value={toText(li.bomId)} />
                      <DetailItem label="Cost per item" value={toText(li.costPerItem)} />
                      <DetailItem label="Quantity" value={toText(li.quantity)} />
                      <DetailItem label="Item description" value={toText(li.itemDescription)} />
                    </dl>
                  </div>
                ))}
              </div>

              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-full text-sm">
                  <caption className="sr-only">Bulk line items</caption>
                  <thead className="bg-slate-100 dark:bg-slate-800">
                    <tr>
                      <th scope="col" className="px-3 py-2 text-left font-medium">Sl. No.</th>
                      <th scope="col" className="px-3 py-2 text-left font-medium">Component Name</th>
                      <th scope="col" className="px-3 py-2 text-left font-medium">BOM ID</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Cost per item</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Quantity</th>
                      <th scope="col" className="px-3 py-2 text-left font-medium">Item Description</th>
                      <th scope="col" className="px-3 py-2 text-left font-medium">Zoho check</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {lineRows.map((li, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">{Number(li.sortOrder ?? i) + 1}</td>
                        <td className="px-3 py-2">{String(li.componentName ?? "")}</td>
                        <td className="px-3 py-2">{String(li.bomId ?? "")}</td>
                        <td className="px-3 py-2 text-right">{li.costPerItem != null ? String(li.costPerItem) : ""}</td>
                        <td className="px-3 py-2 text-right">{li.quantity != null ? String(li.quantity) : ""}</td>
                        <td className="px-3 py-2">{String(li.itemDescription ?? "")}</td>
                        <td className="px-3 py-2">{li.zohoAvailable === true ? "Available" : li.zohoAvailable === false ? "Not available" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DetailCard>
          )}
        </main>
      </div>

      <div className="mt-8">
        <TicketComments ticketId={ticket.id} />
      </div>
    </div>
  );
}
