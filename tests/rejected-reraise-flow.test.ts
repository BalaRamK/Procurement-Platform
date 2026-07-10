import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("requester can re-raise a rejected request without creating a new ticket", () => {
  const requestRoute = readFileSync("src/app/api/requests/[id]/route.ts", "utf-8");
  const requestPage = readFileSync("src/app/requests/[id]/page.tsx", "utf-8");
  const ticketActions = readFileSync("src/components/requests/TicketActions.tsx", "utf-8");

  assert.ok(requestRoute.includes('"reraised"'));
  assert.ok(requestRoute.includes("Only rejected tickets can be re-raised"));
  assert.ok(requestRoute.includes("Only the requester can re-raise this request"));
  assert.ok(requestRoute.includes("UPDATE tickets SET status = $1, updated_at = now() WHERE id = $2"));
  assert.ok(!requestRoute.includes("INSERT INTO tickets"));
  assert.ok(requestPage.includes('ticket.status === "REJECTED"'));
  assert.ok(ticketActions.includes("Re-Raise request"));
});
