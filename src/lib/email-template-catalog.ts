export const SUBJECT_PREFIX = "From Procurement Platform | ";

export const EMAIL_TEMPLATE_FIELDS = [
  { key: "requesterName", label: "Requester name" },
  { key: "requesterEmail", label: "Requester email" },
  { key: "ticketId", label: "Request ID" },
  { key: "ticketTitle", label: "Request title" },
  { key: "status", label: "Status" },
  { key: "currentStage", label: "Current stage" },
  { key: "nextStage", label: "Next stage" },
  { key: "department", label: "Department" },
  { key: "teamName", label: "Team" },
  { key: "priority", label: "Priority" },
  { key: "needByDate", label: "Need by date" },
  { key: "estimatedCost", label: "Estimated cost" },
  { key: "description", label: "Description" },
  { key: "rejectionRemarks", label: "Rejection remarks" },
  { key: "actionBy", label: "Action by" },
  { key: "approverPosition", label: "Approver position" },
  { key: "approverName", label: "Approver name" },
  { key: "requestUrl", label: "Request URL" },
] as const;

export const EMAIL_TEMPLATE_TRIGGER_OPTIONS = [
  { value: "request_created", label: "Request created" },
  { value: "request_submitted_to_l1", label: "Request submitted to L1" },
  { value: "l1_approved_moved_to_fh", label: "L1 approved and moved to Department Head" },
  { value: "fh_approved_moved_to_cfo", label: "Department Head approved and moved to CFO" },
  { value: "cfo_approved_moved_to_cdo", label: "CFO approved and moved to CDO" },
  { value: "cdo_approved_moved_to_production", label: "CDO approved and moved to Production" },
  { value: "production_marked_order_placed", label: "Procurement Team marked order placed" },
  { value: "production_marked_delivered", label: "Procurement Team marked delivered" },
  { value: "requester_confirmed_receipt", label: "Requester confirmed receipt" },
  { value: "request_rejected", label: "Request rejected" },
  { value: "pending_fh_reminder", label: "Pending FH reminder" },
  { value: "pending_l1_reminder", label: "Pending L1 reminder" },
  { value: "pending_cfo_reminder", label: "Pending CFO reminder" },
  { value: "pending_cdo_reminder", label: "Pending CDO reminder" },
  { value: "request_auto_closed", label: "Request auto closed" },
  { value: "comment_mention", label: "Comment @mention" },
] as const;

export type TemplateSeed = {
  name: string;
  trigger: string;
  subjectTemplate: string;
  bodyTemplate: string;
  timeline?: "immediate" | "after_24h" | "after_48h" | "custom";
  delayMinutes?: number | null;
  extraRecipients?: string | null;
  enabled?: boolean;
};

function prefixedSubject(subject: string) {
  return subject.startsWith(SUBJECT_PREFIX) ? subject : `${SUBJECT_PREFIX}${subject}`;
}

function standardBody(summary: string, actionLine: string, includeRemarks = false) {
  return [
    "Hello,",
    "",
    "This is an automated Procurement Platform update for the request below.",
    "",
    summary,
    "",
    actionLine,
    "",
    "Use the request link to review the ticket, check the latest workflow stage, and add any clarification comments if needed.",
    "",
    "Request details:",
    "Request ID: {{ticketId}}",
    "Title: {{ticketTitle}}",
    "Requester: {{requesterName}}",
    "Department: {{department}}",
    "Team: {{teamName}}",
    "Priority: {{priority}}",
    "Need by date: {{needByDate}}",
    "Estimated cost: {{estimatedCost}}",
    "Current stage: {{currentStage}}",
    "Next stage: {{nextStage}}",
    "Action by: {{actionBy}}",
    "Next owner: {{approverName}}",
    includeRemarks ? "Rejection remarks: {{rejectionRemarks}}" : "",
    "",
    "Open request: {{requestUrl}}",
    "",
    "Please do not reply to this automated email. Continue the conversation in Procurement Platform so the audit trail remains complete.",
  ]
    .filter(Boolean)
    .join("\n");
}

export const DEFAULT_EMAIL_TEMPLATES: TemplateSeed[] = [
  {
    name: "Request created",
    trigger: "request_created",
    subjectTemplate: prefixedSubject("Request {{ticketId}} created"),
    bodyTemplate: standardBody(
      "A new procurement request has been created in draft status.",
      "Review the request details in Procurement Platform and submit it when the request is ready for the approval workflow."
    ),
  },
  {
    name: "Request submitted to L1",
    trigger: "request_submitted_to_l1",
    subjectTemplate: prefixedSubject("Approval required: {{ticketId}} submitted to L1 Approver"),
    bodyTemplate: standardBody(
      "A procurement request has been submitted and is now waiting for L1 approval.",
      "Please review the item, cost, need-by date, and supporting details in Procurement Platform, then approve or reject the request."
    ),
  },
  {
    name: "L1 approved and moved to Department Head",
    trigger: "l1_approved_moved_to_fh",
    subjectTemplate: prefixedSubject("Approval required: {{ticketId}} moved to Department Head"),
    bodyTemplate: standardBody(
      "The L1 approver has approved this procurement request.",
      "The request is now awaiting Department Head review for business need, team ownership, and priority."
    ),
  },
  {
    name: "Department Head approved and moved to CFO",
    trigger: "fh_approved_moved_to_cfo",
    subjectTemplate: prefixedSubject("Approval required: {{ticketId}} moved to CFO"),
    bodyTemplate: standardBody(
      "The Department Head has approved this procurement request.",
      "The request is now awaiting Finance Team review for budget, cost, and commercial approval."
    ),
  },
  {
    name: "CFO approved and moved to CDO",
    trigger: "cfo_approved_moved_to_cdo",
    subjectTemplate: prefixedSubject("Approval required: {{ticketId}} moved to CDO"),
    bodyTemplate: standardBody(
      "The Finance Team has approved this procurement request.",
      "The request is now awaiting CDO approval before it can move to the Procurement Team for fulfillment."
    ),
  },
  {
    name: "CDO approved and moved to Procurement Team",
    trigger: "cdo_approved_moved_to_production",
    subjectTemplate: prefixedSubject("Action required: {{ticketId}} assigned to Procurement Team"),
    bodyTemplate: standardBody(
      "The CDO has given final approval for this procurement request.",
      "The request is now assigned to the Procurement Team. Please begin sourcing or purchase processing and mark the order as placed once the order is confirmed."
    ),
  },
  {
    name: "Procurement Team marked order placed",
    trigger: "production_marked_order_placed",
    subjectTemplate: prefixedSubject("Order placed: {{ticketId}}"),
    bodyTemplate: standardBody(
      "The Procurement Team has placed the order for this request.",
      "You can track the ticket in Procurement Platform while the order is being fulfilled. No requester action is required until the request is marked as delivered."
    ),
  },
  {
    name: "Procurement Team marked delivered",
    trigger: "production_marked_delivered",
    subjectTemplate: prefixedSubject("Delivered: {{ticketId}} has been marked as delivered"),
    bodyTemplate: standardBody(
      "The Procurement Team has marked this procurement request as delivered to the requester.",
      "Please verify the delivered item or service. If everything is correct, confirm receipt in Procurement Platform so the ticket can be closed."
    ),
  },
  {
    name: "Requester confirmed receipt",
    trigger: "requester_confirmed_receipt",
    subjectTemplate: prefixedSubject("Receipt confirmed: {{ticketId}}"),
    bodyTemplate: standardBody(
      "The requester has confirmed receipt of the requested item or service.",
      "The procurement ticket is now closed. No further action is required unless follow-up is needed in Procurement Platform."
    ),
  },
  {
    name: "Request rejected",
    trigger: "request_rejected",
    subjectTemplate: prefixedSubject("Request {{ticketId}} was rejected"),
    bodyTemplate: standardBody(
      "This procurement request has been rejected during the approval workflow.",
      "Please review the rejection remarks in Procurement Platform, make any required changes, and create or resubmit the request as appropriate.",
      true
    ),
  },
  {
    name: "Pending FH reminder",
    trigger: "pending_fh_reminder",
    subjectTemplate: prefixedSubject("Reminder: {{ticketId}} is pending Department Head approval"),
    bodyTemplate: standardBody(
      "This procurement request is still pending Department Head approval.",
      "Please open the request in Procurement Platform and take action so the procurement workflow can continue."
    ),
  },
  {
    name: "Pending L1 reminder",
    trigger: "pending_l1_reminder",
    subjectTemplate: prefixedSubject("Reminder: {{ticketId}} is pending L1 approval"),
    bodyTemplate: standardBody(
      "This procurement request is still pending L1 approval.",
      "Please open the request in Procurement Platform and take action so the procurement workflow can continue."
    ),
  },
  {
    name: "Pending CFO reminder",
    trigger: "pending_cfo_reminder",
    subjectTemplate: prefixedSubject("Reminder: {{ticketId}} is pending CFO approval"),
    bodyTemplate: standardBody(
      "This procurement request is still pending Finance Team approval.",
      "Please open the request in Procurement Platform and review the commercial details so the workflow can continue."
    ),
  },
  {
    name: "Pending CDO reminder",
    trigger: "pending_cdo_reminder",
    subjectTemplate: prefixedSubject("Reminder: {{ticketId}} is pending CDO approval"),
    bodyTemplate: standardBody(
      "This procurement request is still pending CDO approval.",
      "Please open the request in Procurement Platform and take final approval action so the Procurement Team can begin fulfillment."
    ),
  },
  {
    name: "Request auto closed",
    trigger: "request_auto_closed",
    subjectTemplate: prefixedSubject("Request {{ticketId}} was auto closed"),
    bodyTemplate: standardBody(
      "This procurement request was automatically closed after delivery because receipt confirmation was not recorded within the configured window.",
      "If the closure needs attention, open the ticket in Procurement Platform and contact the Procurement Team."
    ),
  },
  {
    name: "Comment mention",
    trigger: "comment_mention",
    subjectTemplate: prefixedSubject("You were mentioned on request {{ticketId}}"),
    bodyTemplate: standardBody(
      "You were mentioned in a comment on this procurement request.",
      "Please open the request in Procurement Platform to review the latest comment and respond in the ticket if needed."
    ),
  },
];
