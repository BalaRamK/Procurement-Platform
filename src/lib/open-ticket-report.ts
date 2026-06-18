import { STATUS_LABELS } from "@/lib/constants";

export const OPEN_TICKET_REPORT_HEADERS = [
  "Sl. No.",
  "Request ID",
  "Requestor Name",
  "Team",
  "Created On",
  "Ticket Title",
  "Item",
  "Pending with",
] as const;

export type OpenTicketReportSource = {
  requestId: string | null;
  requesterName: string | null;
  teamName: string | null;
  createdAt: string | Date | null;
  title: string | null;
  item: string | null;
  status: string | null;
  functionalHeadNames?: string | null;
  l1ApproverNames?: string | null;
  cfoNames?: string | null;
  cdoNames?: string | null;
  procurementNames?: string | null;
};

export type OpenTicketReportRow = {
  slNo: number;
  requestId: string;
  requesterName: string;
  team: string;
  createdOn: string;
  ticketTitle: string;
  item: string;
  pendingWith: string;
};

export const OPEN_TICKET_REPORT_SQL = `WITH line_items AS (
       SELECT ticket_id,
              string_agg(
                COALESCE(NULLIF(component_name, ''), NULLIF(item_description, ''), ''),
                '; ' ORDER BY sort_order ASC
              ) AS item
       FROM ticket_line_items
       GROUP BY ticket_id
     )
     SELECT
       t.request_id AS "requestId",
       t.requester_name AS "requesterName",
       t.team_name::text AS "teamName",
       t.created_at AS "createdAt",
       t.title,
       COALESCE(NULLIF(li.item, ''), NULLIF(t.item_name, ''), NULLIF(t.component_description, ''), NULLIF(t.description, ''), t.title) AS item,
       t.status::text AS status,
       fh.names AS "functionalHeadNames",
       l1.names AS "l1ApproverNames",
       cfo.names AS "cfoNames",
       cdo.names AS "cdoNames",
       prod.names AS "procurementNames"
     FROM tickets t
     LEFT JOIN line_items li ON li.ticket_id = t.id
     LEFT JOIN LATERAL (
       SELECT string_agg(COALESCE(NULLIF(name, ''), email), ', ' ORDER BY name NULLS LAST, email) AS names
       FROM users
       WHERE roles @> ARRAY['FUNCTIONAL_HEAD']::"UserRole"[] AND team = t.team_name AND status = true
     ) fh ON true
     LEFT JOIN LATERAL (
       SELECT string_agg(COALESCE(NULLIF(name, ''), email), ', ' ORDER BY name NULLS LAST, email) AS names
       FROM users
       WHERE roles @> ARRAY['L1_APPROVER']::"UserRole"[] AND team = t.team_name AND status = true
     ) l1 ON true
     LEFT JOIN LATERAL (
       SELECT string_agg(COALESCE(NULLIF(name, ''), email), ', ' ORDER BY name NULLS LAST, email) AS names
       FROM users
       WHERE roles @> ARRAY['CFO']::"UserRole"[] AND status = true
     ) cfo ON true
     LEFT JOIN LATERAL (
       SELECT string_agg(COALESCE(NULLIF(name, ''), email), ', ' ORDER BY name NULLS LAST, email) AS names
       FROM users
       WHERE roles @> ARRAY['CDO']::"UserRole"[] AND status = true
     ) cdo ON true
     LEFT JOIN LATERAL (
       SELECT string_agg(COALESCE(NULLIF(name, ''), email), ', ' ORDER BY name NULLS LAST, email) AS names
       FROM users
       WHERE roles @> ARRAY['PRODUCTION']::"UserRole"[] AND status = true
     ) prod ON true
     WHERE t.status NOT IN ('CLOSED', 'REJECTED')
     ORDER BY t.created_at DESC`;

function clean(value: string | null | undefined) {
  return value?.trim() || "";
}

function formatDate(value: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function roleWithNames(role: string, names: string | null | undefined) {
  const cleaned = clean(names);
  return cleaned ? `${role} - ${cleaned}` : role;
}

export function getOpenTicketPendingWith(row: OpenTicketReportSource) {
  switch (row.status) {
    case "DRAFT":
      return roleWithNames("Requester", row.requesterName);
    case "PENDING_FH_APPROVAL":
      return roleWithNames("Department Head", row.functionalHeadNames);
    case "PENDING_L1_APPROVAL":
      return roleWithNames("L1 Approver", row.l1ApproverNames);
    case "PENDING_CFO_APPROVAL":
      return roleWithNames("Finance Team", row.cfoNames);
    case "PENDING_CDO_APPROVAL":
      return roleWithNames("CDO", row.cdoNames);
    case "ASSIGNED_TO_PRODUCTION":
    case "ORDER_PLACED":
      return roleWithNames("Procurement Team", row.procurementNames);
    case "DELIVERED_TO_REQUESTER":
    case "CONFIRMED_BY_REQUESTER":
      return roleWithNames("Requester", row.requesterName);
    default:
      return STATUS_LABELS[row.status ?? ""] ?? clean(row.status) ?? "";
  }
}

export function toOpenTicketReportRows(rows: OpenTicketReportSource[]): OpenTicketReportRow[] {
  return rows.map((row, index) => ({
    slNo: index + 1,
    requestId: clean(row.requestId),
    requesterName: clean(row.requesterName),
    team: clean(row.teamName),
    createdOn: formatDate(row.createdAt),
    ticketTitle: clean(row.title),
    item: clean(row.item),
    pendingWith: getOpenTicketPendingWith(row),
  }));
}

export function toOpenTicketReportSheet(rows: OpenTicketReportRow[]) {
  const keys: (keyof OpenTicketReportRow)[] = [
    "slNo",
    "requestId",
    "requesterName",
    "team",
    "createdOn",
    "ticketTitle",
    "item",
    "pendingWith",
  ];
  return [
    [...OPEN_TICKET_REPORT_HEADERS],
    ...rows.map((row) => keys.map((key) => row[key])),
  ];
}
