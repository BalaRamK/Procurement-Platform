import assert from "node:assert/strict";
import test from "node:test";
import { parseBulkUploadRows } from "../src/lib/bulk-upload";

test("bulk upload accepts common procurement spreadsheet headers and formatted prices", () => {
  const rows = [
    ["S.No", "Item Name", "BOM", "Unit Price", "Qty", "Remarks"],
    [1, "Laser diode", "BOM-1001", "₹1,200.50", "2", "For optical bench"],
  ];

  const parsed = parseBulkUploadRows(rows);

  assert.deepEqual(parsed, [
    {
      slNo: 1,
      componentName: "Laser diode",
      bomId: "BOM-1001",
      costPerItem: 1200.5,
      quantity: 2,
      itemDescription: "For optical bench",
    },
  ]);
});

test("bulk upload reports missing required columns clearly", () => {
  const rows = [
    ["Component", "Description"],
    ["Laser diode", "Missing cost and quantity columns"],
  ];

  assert.throws(
    () => parseBulkUploadRows(rows),
    /Missing required columns: Cost per item, Quantity/
  );
});

test("bulk upload finds the header row below template instruction rows", () => {
  const rows = [
    ["Procurement bulk upload template"],
    ["Fill the item details below"],
    ["Sl. No.", "Component Name", "BOM ID", "Cost per item", "Quantity", "Item Description"],
    [1, "Detector module", "BOM-2001", "2,500", 3, "For lab setup"],
  ];

  const parsed = parseBulkUploadRows(rows);

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].componentName, "Detector module");
  assert.equal(parsed[0].costPerItem, 2500);
  assert.equal(parsed[0].quantity, 3);
});
