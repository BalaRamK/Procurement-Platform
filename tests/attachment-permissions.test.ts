import assert from "node:assert/strict";
import test from "node:test";
import { canUploadAttachment } from "../src/lib/attachment-permissions";

test("requester can upload attachments after draft", () => {
  assert.equal(
    canUploadAttachment({
      activeRole: "REQUESTER",
      roles: ["REQUESTER"],
      ticket: { requesterId: "requester-1", requesterEmail: "requester@qnulabs.com", status: "ORDER_PLACED" },
      currentUserId: "requester-1",
      sessionEmail: "requester@qnulabs.com",
    }),
    true
  );
});

test("procurement can upload attachments at production stages", () => {
  assert.equal(
    canUploadAttachment({
      activeRole: "PRODUCTION",
      roles: ["PRODUCTION"],
      ticket: { requesterId: "requester-1", status: "ASSIGNED_TO_PRODUCTION" },
      currentUserId: "procurement-1",
    }),
    true
  );
});

test("finance approval and CFO can upload only at their active approval stage", () => {
  assert.equal(
    canUploadAttachment({
      activeRole: "FINANCE_APPROVER",
      roles: ["FINANCE_APPROVER"],
      ticket: { requesterId: "requester-1", status: "PENDING_FINANCE_APPROVAL" },
      currentUserId: "finance-1",
    }),
    true
  );
  assert.equal(
    canUploadAttachment({
      activeRole: "CFO",
      roles: ["CFO"],
      ticket: { requesterId: "requester-1", status: "PENDING_CFO_APPROVAL" },
      currentUserId: "cfo-1",
    }),
    true
  );
  assert.equal(
    canUploadAttachment({
      activeRole: "CFO",
      roles: ["CFO"],
      ticket: { requesterId: "requester-1", status: "PENDING_CDO_APPROVAL" },
      currentUserId: "cfo-1",
    }),
    false
  );
});

test("read-only vertical owner cannot upload attachments", () => {
  assert.equal(
    canUploadAttachment({
      activeRole: "VERTICAL_OWNER",
      roles: ["VERTICAL_OWNER"],
      ticket: { requesterId: "requester-1", status: "PENDING_L1_APPROVAL" },
      currentUserId: "owner-1",
    }),
    false
  );
});
