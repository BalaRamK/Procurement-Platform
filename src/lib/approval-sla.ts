import { query } from "@/lib/db";

export const APPROVAL_SLA_STAGES = [
  { key: "l1", label: "L1 Approval" },
  { key: "departmentHead", label: "Department Head" },
  { key: "finance", label: "Finance Approval" },
  { key: "cfo", label: "CFO" },
  { key: "cdo", label: "CDO" },
] as const;

export type ApprovalSlaStageKey = (typeof APPROVAL_SLA_STAGES)[number]["key"];

export type ApprovalSlaRow = {
  stage: ApprovalSlaStageKey;
  averageHours: number | null;
  completedCount: number;
};

export const APPROVAL_SLA_SQL = `WITH stage_times AS (
  SELECT
    t.id,
    t.created_at AS created_at,
    MIN(a.created_at) FILTER (WHERE u.roles @> ARRAY['L1_APPROVER']::"UserRole"[] AND a.action = 'approved') AS l1_at,
    MIN(a.created_at) FILTER (WHERE u.roles @> ARRAY['FUNCTIONAL_HEAD']::"UserRole"[] AND a.action = 'approved') AS fh_at,
    MIN(a.created_at) FILTER (WHERE u.roles @> ARRAY['FINANCE_APPROVER']::"UserRole"[] AND a.action = 'approved') AS finance_at,
    MIN(a.created_at) FILTER (WHERE u.roles @> ARRAY['CFO']::"UserRole"[] AND a.action = 'approved') AS cfo_at,
    MIN(a.created_at) FILTER (WHERE u.roles @> ARRAY['CDO']::"UserRole"[] AND a.action = 'approved') AS cdo_at
  FROM tickets t
  LEFT JOIN approval_logs a ON a.ticket_id = t.id
  LEFT JOIN users u ON u.id = a.user_id
  GROUP BY t.id
), durations AS (
  SELECT 'l1' AS stage, EXTRACT(EPOCH FROM (l1_at - created_at)) / 3600.0 AS hours FROM stage_times WHERE l1_at IS NOT NULL
  UNION ALL
  SELECT 'departmentHead', EXTRACT(EPOCH FROM (fh_at - l1_at)) / 3600.0 FROM stage_times WHERE fh_at IS NOT NULL AND l1_at IS NOT NULL
  UNION ALL
  SELECT 'finance', EXTRACT(EPOCH FROM (finance_at - fh_at)) / 3600.0 FROM stage_times WHERE finance_at IS NOT NULL AND fh_at IS NOT NULL
  UNION ALL
  SELECT 'cfo', EXTRACT(EPOCH FROM (cfo_at - COALESCE(finance_at, fh_at))) / 3600.0 FROM stage_times WHERE cfo_at IS NOT NULL AND COALESCE(finance_at, fh_at) IS NOT NULL
  UNION ALL
  SELECT 'cdo', EXTRACT(EPOCH FROM (cdo_at - cfo_at)) / 3600.0 FROM stage_times WHERE cdo_at IS NOT NULL AND cfo_at IS NOT NULL
)
SELECT stage, AVG(hours)::float AS "averageHours", COUNT(*)::int AS "completedCount"
FROM durations
GROUP BY stage`;

export function formatApprovalDuration(hours: number | null | undefined) {
  if (hours == null || !Number.isFinite(hours)) return "No data";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(hours >= 10 ? 1 : 2)} hrs`;
  return `${(hours / 24).toFixed(1)} days`;
}

export function normalizeApprovalSlaRows(rows: ApprovalSlaRow[]) {
  const byStage = new Map(rows.map((row) => [row.stage, row]));
  return APPROVAL_SLA_STAGES.map((stage) => ({
    ...stage,
    averageHours: byStage.get(stage.key)?.averageHours ?? null,
    completedCount: byStage.get(stage.key)?.completedCount ?? 0,
  }));
}
