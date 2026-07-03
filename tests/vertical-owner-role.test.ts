import assert from "node:assert/strict";
import test from "node:test";
import { ROLE_LABELS } from "../src/lib/constants";
import { canViewTicket } from "../src/lib/tickets";
import { USER_ROLES, getPrimaryRole } from "../src/types/db";

test("vertical owner is a supported role label and primary role", () => {
  assert.ok(USER_ROLES.includes("VERTICAL_OWNER"));
  assert.equal(ROLE_LABELS.VERTICAL_OWNER, "Vertical Owner");
  assert.equal(getPrimaryRole(["REQUESTER", "VERTICAL_OWNER"]), "VERTICAL_OWNER");
});

test("vertical owner can view only tickets in their assigned vertical", () => {
  assert.equal(
    canViewTicket(
      ["VERTICAL_OWNER"],
      "INNOVATION",
      { requesterId: "requester-1", status: "PENDING_CFO_APPROVAL", teamName: "INNOVATION" },
      "vertical-owner-1"
    ),
    true
  );
  assert.equal(
    canViewTicket(
      ["VERTICAL_OWNER"],
      "ENGINEERING",
      { requesterId: "requester-1", status: "PENDING_CFO_APPROVAL", teamName: "INNOVATION" },
      "vertical-owner-1"
    ),
    false
  );
});
