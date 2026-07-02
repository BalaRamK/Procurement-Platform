import assert from "node:assert/strict";
import test from "node:test";
import { formatApprovalDuration, normalizeApprovalSlaRows } from "../src/lib/approval-sla";

test("approval SLA formatter uses minutes, hours, and days", () => {
  assert.equal(formatApprovalDuration(null), "No data");
  assert.equal(formatApprovalDuration(0.5), "30 min");
  assert.equal(formatApprovalDuration(4.25), "4.25 hrs");
  assert.equal(formatApprovalDuration(12.2), "12.2 hrs");
  assert.equal(formatApprovalDuration(72), "3.0 days");
});

test("approval SLA normalizer fills missing stages with no data", () => {
  const rows = normalizeApprovalSlaRows([
    { stage: "l1", averageHours: 2, completedCount: 3 },
    { stage: "finance", averageHours: 5, completedCount: 1 },
  ]);

  assert.equal(rows.length, 5);
  assert.deepEqual(rows[0], { key: "l1", label: "L1 Approval", averageHours: 2, completedCount: 3 });
  assert.deepEqual(rows[2], { key: "finance", label: "Finance Approval", averageHours: 5, completedCount: 1 });
  assert.deepEqual(rows[4], { key: "cdo", label: "CDO", averageHours: null, completedCount: 0 });
});
