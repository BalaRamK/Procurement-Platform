"use client";

import type { OpenTicketReportRow } from "@/lib/open-ticket-report";
import { toOpenTicketReportSheet } from "@/lib/open-ticket-report";

type Props = {
  rows: OpenTicketReportRow[];
};

export function OpenTicketsReportDownload({ rows }: Props) {
  async function downloadExcel() {
    const XLSX = await import("xlsx");
    const data = toOpenTicketReportSheet(rows);
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 16 },
      { wch: 24 },
      { wch: 16 },
      { wch: 16 },
      { wch: 36 },
      { wch: 52 },
      { wch: 28 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Open Tickets");
    XLSX.writeFile(workbook, `open-tickets-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <button type="button" onClick={downloadExcel} className="btn-secondary" disabled={rows.length === 0}>
      Download Excel
    </button>
  );
}
