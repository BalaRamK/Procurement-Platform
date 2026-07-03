import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { PurchaseRequestForm } from "@/components/requests/PurchaseRequestForm";
import { isRequesterForActiveRole } from "@/lib/tickets";
import { getPrimaryRole } from "@/types/db";
import type { CostCurrency, Priority, TeamName } from "@/types/db";

function dateInput(value: unknown) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toText(value: unknown) {
  return value == null ? "" : String(value);
}

export default async function EditDraftRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  const { id } = await params;
  const ticket = await queryOne<Record<string, unknown>>(
    `SELECT t.id, t.title, t.description, t.requester_name AS "requesterName", t.department,
      t.component_description AS "componentDescription", t.item_name AS "itemName",
      t.brand_name_company AS "brandNameCompany", t.preferred_supplier AS "preferredSupplier",
      t.country_of_origin AS "countryOfOrigin", t.bom_id AS "bomId", t.product_id AS "productId",
      t.project_customer AS "projectCustomer", t.need_by_date AS "needByDate",
      t.charge_code AS "chargeCode", t.cost_currency AS "costCurrency", t.estimated_cost AS "estimatedCost",
      t.rate, t.unit, t.estimated_po_date AS "estimatedPoDate", t.place_of_delivery AS "placeOfDelivery",
      t.quantity, t.deal_name AS "dealName", t.team_name AS "teamName", t.priority, t.status,
      t.requester_id AS "requesterId", u.email AS "requesterEmail"
     FROM tickets t LEFT JOIN users u ON u.id = t.requester_id
     WHERE t.id = $1`,
    [id]
  );
  if (!ticket) notFound();
  if (ticket.status !== "DRAFT") redirect(`/requests/${id}`);

  const activeRole = session.user.activeRole ?? getPrimaryRole(session.user.roles);
  const requesterEmail = toText(ticket.requesterEmail).trim().toLowerCase();
  const sessionEmail = session.user.email?.trim().toLowerCase() ?? "";
  const isRequester = isRequesterForActiveRole(activeRole, toText(ticket.requesterId), session.user.id, requesterEmail, sessionEmail);
  if (!isRequester) redirect(`/requests/${id}`);

  const lineItems = await query<Record<string, unknown>>(
    `SELECT sort_order AS "sortOrder", component_name AS "componentName", bom_id AS "bomId",
      cost_per_item AS "costPerItem", quantity, item_description AS "itemDescription",
      manufacturer, preferred_supplier AS "preferredSupplier", country_of_origin AS "countryOfOrigin",
      extra_spares AS "extraSpares", remarks, zoho_available AS "zohoAvailable"
     FROM ticket_line_items WHERE ticket_id = $1 ORDER BY sort_order ASC`,
    [id]
  );

  return (
    <PurchaseRequestForm
      requesterName={toText(ticket.requesterName)}
      requesterEmail={requesterEmail}
      requesterTeam={(session.user.team ?? ticket.teamName) as TeamName}
      canChooseTeam={false}
      mode="edit"
      ticketId={id}
      initialValues={{
        title: toText(ticket.title),
        description: toText(ticket.description),
        requesterName: toText(ticket.requesterName),
        department: toText(ticket.department),
        componentDescription: toText(ticket.componentDescription),
        bomId: toText(ticket.bomId),
        productId: toText(ticket.productId),
        itemName: toText(ticket.itemName),
        brandNameCompany: toText(ticket.brandNameCompany),
        preferredSupplier: toText(ticket.preferredSupplier),
        countryOfOrigin: toText(ticket.countryOfOrigin),
        projectCustomer: toText(ticket.projectCustomer),
        needByDate: dateInput(ticket.needByDate),
        chargeCode: toText(ticket.chargeCode),
        costCurrency: (ticket.costCurrency || "INR") as CostCurrency,
        estimatedCost: toText(ticket.estimatedCost),
        rate: toText(ticket.rate),
        unit: toText(ticket.unit),
        estimatedPODate: dateInput(ticket.estimatedPoDate),
        placeOfDelivery: toText(ticket.placeOfDelivery),
        quantity: toText(ticket.quantity || "1"),
        dealName: toText(ticket.dealName),
        teamName: ticket.teamName as TeamName,
        priority: ticket.priority as Priority,
        lineItems: lineItems.map((row, index) => ({
          slNo: Number(row.sortOrder ?? index) + 1,
          componentName: toText(row.componentName),
          bomId: toText(row.bomId),
          costPerItem: Number(row.costPerItem ?? 0),
          quantity: Number(row.quantity ?? 1),
          itemDescription: toText(row.itemDescription),
          manufacturer: toText(row.manufacturer),
          preferredSupplier: toText(row.preferredSupplier),
          countryOfOrigin: toText(row.countryOfOrigin),
          extraSpares: toText(row.extraSpares),
          remarks: toText(row.remarks),
          zohoAvailable: typeof row.zohoAvailable === "boolean" ? row.zohoAvailable : undefined,
        })),
      }}
    />
  );
}
