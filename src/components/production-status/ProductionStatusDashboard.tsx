"use client";

import { useMemo, useState } from "react";
import type { ProductionStatusRow } from "@/lib/production-status-data";

type SyncInfo = {
  lastSuccessAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
} | null;

type Props = {
  rows: ProductionStatusRow[];
  todayIso: string;
  sync: SyncInfo;
};

type SortKey = "expected" | "requested" | "system";

const DAY_MS = 86_400_000;

function fmtDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function fmtMonth(key: string) {
  return new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return null;
  return `${new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST`;
}

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (s.includes("deliver") || s.includes("complete")) return "bg-emerald-100 text-emerald-900 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-100 dark:ring-emerald-400/20";
  if (s.includes("production")) return "bg-sky-100 text-sky-900 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-100 dark:ring-sky-400/20";
  if (s.includes("procure")) return "bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-400/20";
  if (s.includes("hold") || s.includes("delay") || s.includes("block")) return "bg-rose-100 text-rose-900 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-100 dark:ring-rose-400/20";
  return "bg-slate-100 text-slate-800 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-100 dark:ring-slate-400/20";
}

function countBy<T>(items: T[], keyOf: (item: T) => string): [string, number][] {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyOf(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts);
}

function StatCard({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="card border border-white/25 p-4 shadow-lg shadow-slate-950/5 dark:border-white/10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${tone || "text-slate-900 dark:text-white"}`}>{value}</p>
    </div>
  );
}

function BarList({ title, entries, barClass }: { title: string; entries: [string, number][]; barClass: string }) {
  const max = Math.max(1, ...entries.map(([, n]) => n));
  return (
    <section className="card border border-white/25 p-4 shadow-lg shadow-slate-950/5 dark:border-white/10">
      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">{title}</h2>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">No data.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {entries.map(([label, count]) => (
            <li key={label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-slate-700 dark:text-slate-200">{label}</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{count}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-200/70 dark:bg-white/10">
                <div className={`h-2 rounded-full ${barClass}`} style={{ width: `${Math.max(4, (count / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ProductionStatusDashboard({ rows, todayIso, sync }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [delayedOnly, setDelayedOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("expected");

  const enriched = useMemo(
    () =>
      rows.map((row) => {
        const delivered = !!row.deliveredDate || /^deliver/i.test(row.status);
        const daysLate =
          !delivered && row.expectedDate && row.expectedDate < todayIso
            ? Math.round((Date.parse(todayIso) - Date.parse(row.expectedDate)) / DAY_MS)
            : 0;
        return { ...row, delivered, delayed: daysLate > 0, daysLate };
      }),
    [rows, todayIso]
  );

  const total = enriched.length;
  const deliveredCount = enriched.filter((r) => r.delivered).length;
  const delayedCount = enriched.filter((r) => r.delayed).length;

  const byStatus = useMemo(() => countBy(enriched, (r) => r.status || "No status").sort((a, b) => b[1] - a[1]), [enriched]);
  const byType = useMemo(() => countBy(enriched, (r) => r.productType || "Unspecified").sort((a, b) => b[1] - a[1]), [enriched]);
  const byMonth = useMemo(
    () =>
      countBy(enriched.filter((r) => r.expectedDate), (r) => r.expectedDate!.slice(0, 7))
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, count]) => [fmtMonth(key), count] as [string, number]),
    [enriched]
  );

  const statuses = byStatus.map(([s]) => s);
  const types = byType.map(([t]) => t);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = enriched.filter((r) => {
      if (statusFilter !== "all" && (r.status || "No status") !== statusFilter) return false;
      if (typeFilter !== "all" && (r.productType || "Unspecified") !== typeFilter) return false;
      if (delayedOnly && !r.delayed) return false;
      if (q && !`${r.systemId} ${r.customer} ${r.productType} ${r.remarks}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const cmpDate = (a: string | null, b: string | null, desc = false) => {
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      return desc ? b.localeCompare(a) : a.localeCompare(b);
    };
    return filtered.sort((a, b) => {
      if (sort === "requested") return cmpDate(a.requestedDate, b.requestedDate, true);
      if (sort === "system") return a.systemId.localeCompare(b.systemId, undefined, { numeric: true });
      return cmpDate(a.expectedDate, b.expectedDate);
    });
  }, [enriched, search, statusFilter, typeFilter, delayedOnly, sort]);

  const lastSynced = fmtDateTime(sync?.lastSuccessAt ?? null);
  const syncFailed = sync?.lastStatus === "error";

  if (total === 0) {
    return (
      <div className="card border border-white/25 p-8 text-center shadow-lg shadow-slate-950/5 dark:border-white/10">
        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">No production data yet</p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
          The sheet has not been synced yet{syncFailed && sync?.lastError ? ` (last attempt failed: ${sync.lastError})` : ""}. It refreshes automatically every day.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500 dark:text-slate-300">
        {lastSynced ? `Last synced ${lastSynced}. ` : ""}Refreshes automatically every day from the production sheet.
      </p>
      {syncFailed && (
        <p className="rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
          The most recent sync failed, so this shows the last successful data{lastSynced ? ` (${lastSynced})` : ""}.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total systems" value={total} />
        <StatCard label="In progress" value={total - deliveredCount} tone="text-sky-700 dark:text-sky-300" />
        <StatCard label="Delivered" value={deliveredCount} tone="text-emerald-700 dark:text-emerald-300" />
        <StatCard label="Delayed" value={delayedCount} tone={delayedCount > 0 ? "text-rose-700 dark:text-rose-300" : ""} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <BarList title="By status" entries={byStatus} barClass="bg-primary-500" />
        <BarList title="By product type" entries={byType} barClass="bg-teal-500" />
        <BarList title="Expected delivery by month" entries={byMonth} barClass="bg-indigo-500" />
      </div>

      <section className="card border border-white/25 p-4 shadow-lg shadow-slate-950/5 dark:border-white/10">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Search</label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-base"
              placeholder="System ID, customer, product or remarks"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-base">
              <option value="all">All statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Product type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-base">
              <option value="all">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Sort by</label>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="input-base">
              <option value="expected">Expected delivery (soonest)</option>
              <option value="requested">Requested date (newest)</option>
              <option value="system">System ID</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={delayedOnly}
              onChange={(e) => setDelayedOnly(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500/30"
            />
            Delayed only
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-300">Showing {visible.length} of {total} systems.</p>
        </div>
      </section>

      <div className="card overflow-hidden border border-white/25 shadow-lg shadow-slate-950/5 dark:border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/20 dark:divide-white/10">
            <caption className="sr-only">Production status by system</caption>
            <thead>
              <tr>
                {["System ID", "Product type", "Customer / inventory", "Status", "Requested", "Expected delivery", "Delivered", "Remarks"].map((h) => (
                  <th key={h} scope="col" className="card-header whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20 bg-white/25 dark:bg-white/5">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-300">
                    No systems match these filters.
                  </td>
                </tr>
              ) : (
                visible.map((r) => (
                  <tr key={r.rowNumber} className="table-row-glass transition-colors">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{r.systemId || "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{r.productType || "-"}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{r.customer || "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusTone(r.status)}`}>
                        {r.status || "No status"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{fmtDate(r.requestedDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <span className={r.delayed ? "font-semibold text-rose-700 dark:text-rose-300" : "text-slate-700 dark:text-slate-200"}>
                        {fmtDate(r.expectedDate)}
                      </span>
                      {r.delayed && (
                        <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800 dark:bg-rose-500/20 dark:text-rose-200">
                          {r.daysLate} day{r.daysLate === 1 ? "" : "s"} late
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{fmtDate(r.deliveredDate)}</td>
                    <td className="max-w-xs px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{r.remarks || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
