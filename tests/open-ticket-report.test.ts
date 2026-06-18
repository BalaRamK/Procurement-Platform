import assert from "node:assert/strict";
import test from "node:test";
import {
  OPEN_TICKET_REPORT_HEADERS,
  getOpenTicketPendingWith,
  toOpenTicketReportRows,
  toOpenTicketReportSheet,
} from "../src/lib/open-ticket-report";

test("open ticket report uses requested export headers", () => {
  assert.deepEqual([...OPEN_TICKET_REPORT_HEADERS], [
    "Sl. No.",
    "Request ID",
    "Requestor Name",
    "Team",
    "Created On",
    "Ticket Title",
    "Item",
    "Pending with",
  ]);
});

test("open ticket report maps pending owner by lifecycle status", () => {
  assert.equal(
    getOpenTicketPendingWith({
      requestId: "IN396326",
      requesterName: "Nanjunda M",
      teamName: "INNOVATION",
      createdAt: "2026-06-12T00:00:00.000Z",
      title: "QKD3.0 R&D Component procurement",
      item: "STNRGM-20",
      status: "PENDING_FH_APPROVAL",
      functionalHeadNames: "Dilip",
    }),
    "Department Head - Dilip"
  );
});

test("open ticket report formats rows for the table and Excel download", () => {
  const rows = toOpenTicketReportRows([
    {
      requestId: "IN396326",
      requesterName: "Nanjunda M",
      teamName: "INNOVATION",
      createdAt: "2026-06-12T00:00:00.000Z",
      title: "QKD3.0 R&D Component procurement",
      item: "STNRGM-20 single-photon detector module",
      status: "PENDING_FH_APPROVAL",
      functionalHeadNames: "Dilip",
    },
  ]);

  assert.equal(rows[0].slNo, 1);
  assert.equal(rows[0].createdOn, "Jun 12, 2026");
  assert.equal(rows[0].pendingWith, "Department Head - Dilip");
  assert.deepEqual(toOpenTicketReportSheet(rows)[0], [...OPEN_TICKET_REPORT_HEADERS]);
  assert.deepEqual(toOpenTicketReportSheet(rows)[1], [
    1,
    "IN396326",
    "Nanjunda M",
    "INNOVATION",
    "Jun 12, 2026",
    "QKD3.0 R&D Component procurement",
    "STNRGM-20 single-photon detector module",
    "Department Head - Dilip",
  ]);
});
