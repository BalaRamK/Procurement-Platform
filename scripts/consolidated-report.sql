-- Consolidated indent report: all tickets since go-live, with status as of today.
-- Run on the VM (see usage below). Drafts are excluded (not yet submitted).
--
-- Status buckets:
--   CLOSED       = CLOSED, CONFIRMED_BY_REQUESTER
--   REJECTED     = REJECTED
--   DELAYED      = not closed/rejected AND need_by_date is before today
--   IN PROGRESS  = every other open status
-- Cost: ticket estimated_cost, or sum of line items (cost_per_item * quantity) for bulk requests.
-- Costs are in each ticket's own currency (see "currency" column); they are not converted.

CREATE TEMP VIEW indent_report AS
SELECT
  t.request_id,
  t.created_at::date                              AS raised_on,
  t.requester_name,
  COALESCE(NULLIF(t.project_customer, ''), NULLIF(t.deal_name, ''), '-') AS project_name,
  t.team_name,
  t.status                                        AS current_stage,
  CASE
    WHEN t.status IN ('CLOSED', 'CONFIRMED_BY_REQUESTER') THEN 'CLOSED'
    WHEN t.status = 'REJECTED'                            THEN 'REJECTED'
    WHEN t.need_by_date < CURRENT_DATE                    THEN 'DELAYED'
    ELSE 'IN PROGRESS'
  END                                             AS report_status,
  t.need_by_date,
  t.cost_currency                                 AS currency,
  COALESCE(t.estimated_cost,
           (SELECT SUM(li.cost_per_item * li.quantity) FROM ticket_line_items li WHERE li.ticket_id = t.id)
          )                                       AS estimated_cost
FROM tickets t
WHERE t.status <> 'DRAFT';

-- 1) Summary
SELECT 'TOTAL INDENTS' AS metric, COUNT(*) AS indents FROM indent_report
UNION ALL
SELECT report_status, COUNT(*) FROM indent_report GROUP BY report_status;

-- 2) Detail (export this one to CSV)
SELECT * FROM indent_report ORDER BY raised_on, request_id;
