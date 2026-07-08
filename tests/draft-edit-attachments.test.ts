import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("new request form exposes INR, dollar, and Euro currency choices", () => {
  const source = readFileSync("src/components/requests/PurchaseRequestForm.tsx", "utf-8");
  assert.ok(source.includes('{ value: "INR", label: "INR" }'));
  assert.ok(source.includes('{ value: "USD", label: "$" }'));
  assert.ok(source.includes('{ value: "EUR", label: "Euro" }'));
});

test("requesters can edit and delete draft tickets and delete draft attachments", () => {
  const requestRoute = readFileSync("src/app/api/requests/[id]/route.ts", "utf-8");
  const attachmentRoute = readFileSync("src/app/api/requests/[id]/attachments/[attachmentId]/route.ts", "utf-8");
  const ticketActions = readFileSync("src/components/requests/TicketActions.tsx", "utf-8");

  assert.ok(requestRoute.includes('"update_draft"'));
  assert.ok(requestRoute.includes("Only draft tickets can be edited"));
  assert.ok(requestRoute.includes("export async function DELETE"));
  assert.ok(requestRoute.includes("Only draft tickets can be deleted"));
  assert.ok(requestRoute.includes("Only the requester can delete this draft"));
  assert.ok(requestRoute.includes("hasRole(session.user.roles, \"SUPER_ADMIN\")"));
  assert.ok(ticketActions.includes("canDeleteTicket"));
  assert.ok(ticketActions.includes("Delete ticket"));
  assert.ok(ticketActions.includes("Edit draft"));
  assert.ok(ticketActions.includes("Delete draft"));
  assert.ok(attachmentRoute.includes("export async function DELETE"));
  assert.ok(attachmentRoute.includes("Only the requester can delete draft attachments."));
});
