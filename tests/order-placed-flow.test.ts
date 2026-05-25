import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { EMAIL_TEMPLATE_TRIGGER_OPTIONS, DEFAULT_EMAIL_TEMPLATES } from "../src/lib/email-template-catalog";
import { STATUS_LABELS } from "../src/lib/constants";
import { TICKET_STATUSES } from "../src/types/db";

test("order placed is a supported lifecycle status and email trigger", () => {
  assert.ok(TICKET_STATUSES.includes("ORDER_PLACED" as never));
  assert.equal(STATUS_LABELS.ORDER_PLACED, "Order Placed");
  const trigger = EMAIL_TEMPLATE_TRIGGER_OPTIONS.find((option) => option.value === "production_marked_order_placed");
  assert.equal(trigger?.label, "Procurement Team marked order placed");
});

test("workflow emails use expanded procurement platform content and no cc delivery", () => {
  const orderPlaced = DEFAULT_EMAIL_TEMPLATES.find((template) => template.trigger === "production_marked_order_placed");
  assert.ok(orderPlaced?.bodyTemplate.includes("Procurement Platform"));
  assert.ok(orderPlaced?.bodyTemplate.includes("track the ticket"));

  const emailSource = readFileSync("src/lib/email.ts", "utf-8");
  assert.ok(!emailSource.includes("cc:"));
  assert.ok(!emailSource.includes("alwaysCc"));
});
