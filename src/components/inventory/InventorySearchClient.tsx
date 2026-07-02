"use client";

import { useState } from "react";
import { parseBulkUploadRows, type BulkUploadLineItem } from "@/lib/bulk-upload";
import { getBulkTemplateRows, INVENTORY_SEARCH_EXPORT_HEADERS } from "@/lib/bulk-template";

type ZohoResult = {
  found?: boolean;
  componentName?: string | null;
  itemName?: string | null;
  name?: string | null;
  sku?: string | null;
  rate?: number | null;
  unit?: string | null;
  description?: string | null;
  error?: string;
  message?: string;
};

type CheckedItem = BulkUploadLineItem & {
  zohoAvailable?: boolean;
  zohoItemName?: string;
  zohoSku?: string;
  zohoRate?: number | null;
  zohoUnit?: string;
};

async function lookupZoho(term: string): Promise<ZohoResult> {
  const res = await fetch("/api/zoho/items?sku=" + encodeURIComponent(term));
  const data = (await res.json().catch(() => ({}))) as ZohoResult;
  if (!res.ok) {
    return { found: false, error: data.message ?? data.error ?? "Zoho lookup failed" };
  }
  return data;
}

async function downloadWorkbook(filename: string, rows: unknown[][], sheetName: string) {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 8 },
    { wch: 26 },
    { wch: 18 },
    { wch: 14 },
    { wch: 10 },
    { wch: 42 },
    { wch: 20 },
    { wch: 22 },
    { wch: 18 },
    { wch: 18 },
    { wch: 24 },
    { wch: 14 },
    { wch: 26 },
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

export function InventorySearchClient() {
  const [singleTerm, setSingleTerm] = useState("");
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<ZohoResult | null>(null);
  const [bulkRows, setBulkRows] = useState<CheckedItem[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkChecking, setBulkChecking] = useState(false);

  async function searchSingle() {
    if (!singleTerm.trim()) return;
    setSingleLoading(true);
    setSingleResult(null);
    try {
      setSingleResult(await lookupZoho(singleTerm.trim()));
    } finally {
      setSingleLoading(false);
    }
  }

  async function parseExcel(file: File) {
    setBulkStatus(`Reading ${file.name}...`);
    setBulkRows([]);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const errors: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        try {
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as unknown[][];
          const parsed = parseBulkUploadRows(rows);
          setBulkRows(parsed);
          setBulkStatus(`Loaded ${parsed.length} item(s) from ${file.name}. Click Check in Zoho.`);
          return;
        } catch (error) {
          errors.push(`${sheetName}: ${error instanceof Error ? error.message : "Could not parse sheet"}`);
        }
      }
      throw new Error(errors[0] ?? "No readable sheets found.");
    } catch (error) {
      setBulkStatus(error instanceof Error ? error.message : "Could not load Excel file.");
    }
  }

  async function checkBulk() {
    setBulkChecking(true);
    try {
      const checked = await Promise.all(
        bulkRows.map(async (row) => {
          const term = (row.bomId || row.componentName).trim();
          if (!term) return { ...row, zohoAvailable: false };
          const result = await lookupZoho(term);
          return {
            ...row,
            zohoAvailable: !!result.found,
            zohoItemName: result.itemName ?? result.name ?? result.componentName ?? "",
            zohoSku: result.sku ?? "",
            zohoRate: result.rate ?? null,
            zohoUnit: result.unit ?? "",
          };
        })
      );
      setBulkRows(checked);
      setBulkStatus(`Checked ${checked.length} item(s) in Zoho.`);
    } finally {
      setBulkChecking(false);
    }
  }

  function exportChecked() {
    const rows = [
      [...INVENTORY_SEARCH_EXPORT_HEADERS],
      ...bulkRows.map((row) => [
        row.slNo,
        row.componentName,
        row.bomId,
        row.costPerItem,
        row.quantity,
        row.itemDescription,
        row.manufacturer,
        row.preferredSupplier,
        row.countryOfOrigin,
        row.extraSpares,
        row.remarks,
        row.zohoAvailable === true ? "Yes" : row.zohoAvailable === false ? "No" : "Not checked",
        row.zohoItemName ?? "",
        row.zohoSku ?? "",
        row.zohoRate ?? "",
        row.zohoUnit ?? "",
      ]),
    ];
    void downloadWorkbook(`inventory-check-${new Date().toISOString().slice(0, 10)}.xlsx`, rows, "Inventory Check");
  }

  return (
    <div className="space-y-8">
      <section className="card overflow-hidden dark:bg-[#171717] dark:border-white/10">
        <div className="card-header border-b px-6 py-4 dark:bg-[#1f1f1f] dark:border-white/10">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Single item search</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-200">Check whether an item exists in Zoho inventory.</p>
        </div>
        <div className="space-y-4 p-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="singleInventorySearch"
              name="singleInventorySearch"
              value={singleTerm}
              onChange={(event) => setSingleTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void searchSingle();
              }}
              className="input-base"
              placeholder="Search by item name or SKU"
            />
            <button type="button" onClick={searchSingle} disabled={singleLoading || !singleTerm.trim()} className="btn-primary">
              {singleLoading ? "Searching..." : "Search"}
            </button>
          </div>
          {singleResult && (
            <div className={`rounded-2xl border p-4 ${singleResult.found ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              <p className="font-semibold">{singleResult.found ? "Item exists in Zoho" : "Item not found in Zoho"}</p>
              {singleResult.found ? (
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="font-medium">Item</dt><dd>{singleResult.itemName ?? singleResult.name ?? singleResult.componentName ?? "-"}</dd></div>
                  <div><dt className="font-medium">Rate</dt><dd>{singleResult.rate ?? "-"} {singleResult.unit ?? ""}</dd></div>
                  <div><dt className="font-medium">Description</dt><dd>{singleResult.description ?? "-"}</dd></div>
                </dl>
              ) : (
                <p className="mt-2 text-sm">{singleResult.error ?? singleResult.message ?? "No matching item was found."}</p>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="card overflow-hidden dark:bg-[#171717] dark:border-white/10">
        <div className="card-header flex flex-col gap-3 border-b px-6 py-4 dark:bg-[#1f1f1f] dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Bulk inventory check</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-200">Upload Excel rows and populate whether each item exists in Zoho.</p>
          </div>
          <button type="button" className="btn-secondary" onClick={() => void downloadWorkbook("inventory-search-template.xlsx", getBulkTemplateRows(), "Template")}>
            Download Excel Template
          </button>
        </div>
        <div className="space-y-4 p-6">
          <input
            id="bulkInventoryExcel"
            name="bulkInventoryExcel"
            type="file"
            accept=".xlsx,.xls"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void parseExcel(file);
            }}
            className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-700 hover:file:bg-primary-100 dark:text-slate-300 dark:file:bg-primary-900/30 dark:file:text-primary-300"
          />
          {bulkStatus && <p className="text-sm text-slate-600 dark:text-slate-300">{bulkStatus}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-primary" disabled={bulkRows.length === 0 || bulkChecking} onClick={checkBulk}>
              {bulkChecking ? "Checking..." : "Check in Zoho"}
            </button>
            <button type="button" className="btn-secondary" disabled={bulkRows.length === 0} onClick={exportChecked}>
              Download Checked Excel
            </button>
          </div>
          {bulkRows.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Sl. No.</th>
                    <th className="px-3 py-2 text-left font-medium">Item</th>
                    <th className="px-3 py-2 text-left font-medium">BOM ID</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-left font-medium">Exists in Zoho</th>
                    <th className="px-3 py-2 text-left font-medium">Zoho item</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {bulkRows.map((row, index) => (
                    <tr key={`${row.slNo}-${index}`}>
                      <td className="px-3 py-2">{row.slNo}</td>
                      <td className="px-3 py-2">{row.componentName}</td>
                      <td className="px-3 py-2">{row.bomId}</td>
                      <td className="px-3 py-2 text-right">{row.quantity}</td>
                      <td className="px-3 py-2">{row.zohoAvailable === true ? "Yes" : row.zohoAvailable === false ? "No" : "Not checked"}</td>
                      <td className="px-3 py-2">{row.zohoItemName ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
