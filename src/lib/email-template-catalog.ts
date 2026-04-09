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
  { key: "approverName", label: "Approver name" },
  { key: "requestUrl", label: "Request URL" },
] as const;

export const EMAIL_TEMPLATE_TRIGGER_OPTIONS = [
  { value: "request_created", label: "Request created" },
  { value: "request_submitted_to_fh", label: "Request submitted to FH" },
  { value: "request_submitted_to_l1", label: "Request submitted to L1" },
  { value: "fh_approved_moved_to_l1", label: "FH approved and moved to L1" },
  { value: "l1_approved_moved_to_cfo", label: "L1 approved and moved to CFO" },
  { value: "cfo_approved_moved_to_cdo", label: "CFO approved and moved to CDO" },
  { value: "cdo_approved_moved_to_production", label: "CDO approved and moved to Production" },
  { value: "production_marked_delivered", label: "Production marked delivered" },
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
    summary,
    "",
    actionLine,
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
    "Approver: {{approverName}}",
    includeRemarks ? "Rejection remarks: {{rejectionRemarks}}" : "",
    "",
    "Open request: {{requestUrl}}",
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
      "A new procurement request has been created.",
      "No action is required yet. The request remains in draft until it is submitted."
    ),
  },
  {
    name: "Request submitted to FH",
    trigger: "request_submitted_to_fh",
    subjectTemplate: prefixedSubject("Approval required: {{ticketId}} submitted to Department Head"),
    bodyTemplate: standardBody(
      "A procurement request has been submitted for Department Head approval.",
      "Please review and take action on the request."
    ),
  },
  {
    name: "Request submitted to L1",
    trigger: "request_submitted_to_l1",
    subjectTemplate: prefixedSubject("Approval required: {{ticketId}} submitted to L1 Approver"),
    bodyTemplate: standardBody(
      "A procurement request has been submitted for L1 approval.",
      "Please review and take action on the request."
    ),
  },
  {
    name: "FH approved and moved to L1",
    trigger: "fh_approved_moved_to_l1",
    subjectTemplate: prefixedSubject("Approval required: {{ticketId}} moved to L1 Approver"),
    bodyTemplate: standardBody(
      "The Department Head has approved the procurement request.",
      "The request is now awaiting L1 approval."
    ),
  },
  {
    name: "L1 approved and moved to CFO",
    trigger: "l1_approved_moved_to_cfo",
    subjectTemplate: prefixedSubject("Approval required: {{ticketId}} moved to CFO"),
    bodyTemplate: standardBody(
      "The L1 approver has approved the procurement request.",
      "The request is now awaiting CFO approval."
    ),
  },
  {
    name: "CFO approved and moved to CDO",
    trigger: "cfo_approved_moved_to_cdo",
    subjectTemplate: prefixedSubject("Approval required: {{ticketId}} moved to CDO"),
    bodyTemplate: standardBody(
      "The CFO has approved the procurement request.",
      "The request is now awaiting CDO approval."
    ),
  },
  {
    name: "CDO approved and moved to Production",
    trigger: "cdo_approved_moved_to_production",
    subjectTemplate: prefixedSubject("Action required: {{ticketId}} assigned to Procurement Team"),
    bodyTemplate: standardBody(
      "The CDO has approved the procurement request.",
      "The request is now assigned to the Procurement Team for fulfillment."
    ),
  },
  {
    name: "Production marked delivered",
    trigger: "production_marked_delivered",
    subjectTemplate: prefixedSubject("Delivered: {{ticketId}} has been marked as delivered"),
    bodyTemplate: standardBody(
      "The Procurement Team has marked the request as delivered.",
      "Please verify the delivery and confirm receipt."
    ),
  },
  {
    name: "Requester confirmed receipt",
    trigger: "requester_confirmed_receipt",
    subjectTemplate: prefixedSubject("Receipt confirmed: {{ticketId}}"),
    bodyTemplate: standardBody(
      "The requester has confirmed receipt of the requested item or service.",
      "No further action is required unless follow-up is needed."
    ),
  },
  {
    name: "Request rejected",
    trigger: "request_rejected",
    subjectTemplate: prefixedSubject("Request {{ticketId}} was rejected"),
    bodyTemplate: standardBody(
      "The procurement request has been rejected.",
      "Please review the remarks and make any required changes before resubmitting.",
      true
    ),
  },
  {
    name: "Pending FH reminder",
    trigger: "pending_fh_reminder",
    subjectTemplate: prefixedSubject("Reminder: {{ticketId}} is pending Department Head approval"),
    bodyTemplate: standardBody(
      "This is a reminder that the procurement request is still pending Department Head approval.",
      "Please review and take action as soon as possible."
    ),
  },
  {
    name: "Pending L1 reminder",
    trigger: "pending_l1_reminder",
    subjectTemplate: prefixedSubject("Reminder: {{ticketId}} is pending L1 approval"),
    bodyTemplate: standardBody(
      "This is a reminder that the procurement request is still pending L1 approval.",
      "Please review and take action as soon as possible."
    ),
  },
  {
    name: "Pending CFO reminder",
    trigger: "pending_cfo_reminder",
    subjectTemplate: prefixedSubject("Reminder: {{ticketId}} is pending CFO approval"),
    bodyTemplate: standardBody(
      "This is a reminder that the procurement request is still pending CFO approval.",
      "Please review and take action as soon as possible."
    ),
  },
  {
    name: "Pending CDO reminder",
    trigger: "pending_cdo_reminder",
    subjectTemplate: prefixedSubject("Reminder: {{ticketId}} is pending CDO approval"),
    bodyTemplate: standardBody(
      "This is a reminder that the procurement request is still pending CDO approval.",
      "Please review and take action as soon as possible."
    ),
  },
  {
    name: "Request auto closed",
    trigger: "request_auto_closed",
    subjectTemplate: prefixedSubject("Request {{ticketId}} was auto closed"),
    bodyTemplate: standardBody(
      "The request was auto closed after delivery because no receipt confirmation was received within the configured window.",
      "Please contact the Procurement Team if this closure needs attention."
    ),
  },
  {
    name: "Comment mention",
    trigger: "comment_mention",
    subjectTemplate: prefixedSubject("You were mentioned on request {{ticketId}}"),
    bodyTemplate: standardBody(
      "You were mentioned in a comment on this procurement request.",
      "Please open the request to review the latest comment."
    ),
  },
];
