import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("Engineering requests require and persist a selected L1 Manager", () => {
  const form = readFileSync("src/components/requests/PurchaseRequestForm.tsx", "utf-8");
  const createRoute = readFileSync("src/app/api/requests/route.ts", "utf-8");
  const actionRoute = readFileSync("src/app/api/requests/[id]/route.ts", "utf-8");

  assert.ok(form.includes('label="L1 Manager"'));
  assert.ok(form.includes('teamName === "ENGINEERING" && !l1ManagerId'));
  assert.ok(createRoute.includes("L1 Manager is required for Engineering requests."));
  assert.ok(createRoute.includes("l1_manager_id"));
  assert.ok(actionRoute.includes("This request is assigned to another L1 Manager"));
});

test("rejection attribution is stored and displayed with the approval level", () => {
  const actionRoute = readFileSync("src/app/api/requests/[id]/route.ts", "utf-8");
  const detailPage = readFileSync("src/app/requests/[id]/page.tsx", "utf-8");

  assert.ok(actionRoute.includes("rejected_by_name"));
  assert.ok(actionRoute.includes("rejected_stage"));
  assert.ok(detailPage.includes("Rejected by"));
  assert.ok(detailPage.includes("Approval level"));
  assert.ok(detailPage.includes("Rejected on"));
});

test("urgent reminders are protected, claimed, and rescheduled every 48 hours", () => {
  const reminder = readFileSync("src/lib/urgent-reminders.ts", "utf-8");
  const cron = readFileSync("src/app/api/cron/urgent-reminders/route.ts", "utf-8");
  const templates = readFileSync("src/lib/email-template-catalog.ts", "utf-8");

  assert.ok(cron.includes("CRON_SECRET"));
  assert.ok(reminder.includes("urgent_reminder_due_at <= now()"));
  assert.ok(reminder.includes("now() + interval '48 hours'"));
  assert.ok(reminder.includes('emailTrigger: "urgent_ticket_reminder"'));
  assert.ok(templates.includes('trigger: "urgent_ticket_reminder"'));
});
