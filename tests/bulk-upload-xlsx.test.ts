import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { parseBulkUploadRows } from "../src/lib/bulk-upload";

test("bulk upload parses rows from a real xlsx workbook", () => {
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Sl. No.", "Component Name", "BOM ID", "Cost per item", "Quantity", "Item Description"],
    [1, "Laser diode", "BOM-1001", "1,200", 2, "For optical bench"],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Items");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const parsedWorkbook = XLSX.read(buffer, { type: "buffer" });
  const parsedWorksheet = parsedWorkbook.Sheets[parsedWorkbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(parsedWorksheet, { header: 1, defval: "" }) as unknown[][];

  assert.equal(rows.length, 2);
  assert.deepEqual(parseBulkUploadRows(rows), [
    {
      slNo: 1,
      componentName: "Laser diode",
      bomId: "BOM-1001",
      costPerItem: 1200,
      quantity: 2,
      itemDescription: "For optical bench",
    },
  ]);
});
