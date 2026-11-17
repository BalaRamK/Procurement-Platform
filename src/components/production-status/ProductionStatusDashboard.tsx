"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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

type SortKey = "ready" | "requested" | "system";

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

/** "Ready", "Ready for dispatch", ... but not "Not ready". */
function isReadyStatus(status: string) {
  return /ready/i.test(status) && !/not\s*ready/i.test(status);
}

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (s.includes("deliver") || s.includes("complete")) return "bg-emerald-100 text-emerald-900 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-100 dark:ring-emerald-400/20";
  if (isReadyStatus(status)) return "bg-teal-100 text-teal-900 ring-teal-200 dark:bg-teal-500/15 dark:text-teal-100 dark:ring-teal-400/20";
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

function ReadyTile({ name, ready, total }: { name: string; ready: number; total: number }) {
  return (
    <div className="card border border-white/25 p-4 shadow-lg shadow-slate-950/5 dark:border-white/10">
      <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300" title={name}>
        {name}
      </p>
      <p className={`mt-2 text-3xl font-bold ${ready > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-slate-400 dark:text-slate-500"}`}>{ready}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
        Ready, of {total} system{total === 1 ? "" : "s"}
      </p>
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

/** Dropdown with checkboxes. An empty selection means "no filter" (everything). */
function MultiSelect({
  label,
  allLabel,
  options,
  selected,
  onChange,
}: {
  label: string;
  allLabel: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const summary = selected.length === 0 ? allLabel : selected.length === 1 ? selected[0] : `${selected.length} selected`;
  const toggle = (option: string) =>
    onChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]);

  return (
    <div ref={rootRef} className="relative">
      <span id={labelId} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">
        {label}
      </span>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-labelledby={labelId}
        onClick={() => setOpen((value) => !value)}
        className="input-base flex items-center justify-between gap-2 text-left"
      >
        <span className={`truncate ${selected.length === 0 ? "text-slate-500 dark:text-slate-300" : ""}`}>{summary}</span>
        <svg className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          role="group"
          aria-labelledby={labelId}
          className="absolute left-0 z-30 mt-1 max-h-64 w-full min-w-[13rem] overflow-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-slate-900"
        >
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={selected.length === 0}
            className="w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium text-primary-700 hover:bg-slate-100 disabled:text-slate-400 disabled:hover:bg-transparent dark:text-sky-300 dark:hover:bg-white/10 dark:disabled:text-slate-500"
          >
            Clear selection
          </button>
          {options.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-slate-500 dark:text-slate-300">No options.</p>
          ) : (
            options.map((option) => (
              <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10">
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => toggle(option)}
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-primary-600 focus:ring-primary-500/30"
                />
                <span className="truncate" title={option}>
                  {option}
                </span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function ProductionStatusDashboard({ rows, todayIso, sync }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [customerFilter, setCustomerFilter] = useState<string[]>([]);
  const [delayedOnly, setDelayedOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("ready");

  const enriched = useMemo(
    () =>
      rows.map((row) => {
        const delivered = !!row.deliveredDate || /^deliver/i.test(row.status);
        const daysLate =
          !delivered && row.expectedDate && row.expectedDate < todayIso
            ? Math.round((Date.parse(todayIso) - Date.parse(row.expectedDate)) / DAY_MS)
            : 0;
        return {
          ...row,
          statusLabel: row.status || "No status",
          typeLabel: row.productType || "Unspecified",
          customerLabel: row.customer || "Unspecified",
          delivered,
          delayed: daysLate > 0,
          daysLate,
        };
      }),
    [rows, todayIso]
  );

  const total = enriched.length;
  const delayedCount = enriched.filter((r) => r.delayed).length;

  const readyByProduct = useMemo(() => {
    const totals = countBy(enriched, (r) => r.typeLabel);
    const ready = countBy(enriched.filter((r) => isReadyStatus(r.status)), (r) => r.typeLabel);
    const readyOf: Record<string, number> = {};
    for (const [name, count] of ready) readyOf[name] = count;
    return totals
      .map(([name, count]) => ({ name, total: count, ready: readyOf[name] ?? 0 }))
      .sort((a, b) => b.ready - a.ready || a.name.localeCompare(b.name));
  }, [enriched]);
  const totalReady = readyByProduct.reduce((sum, p) => sum + p.ready, 0);

  const byStatus = useMemo(() => countBy(enriched, (r) => r.statusLabel).sort((a, b) => b[1] - a[1]), [enriched]);
  const byType = useMemo(() => countBy(enriched, (r) => r.typeLabel).sort((a, b) => b[1] - a[1]), [enriched]);
  const byMonth = useMemo(
    () =>
      countBy(enriched.filter((r) => r.expectedDate), (r) => r.expectedDate!.slice(0, 7))
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, count]) => [fmtMonth(key), count] as [string, number]),
    [enriched]
  );

  const statusOptions = byStatus.map(([s]) => s);
  const typeOptions = byType.map(([t]) => t);
  const customerOptions = useMemo(
    () => Array.from(new Set(enriched.map((r) => r.customerLabel))).sort((a, b) => a.localeCompare(b)),
    [enriched]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = enriched.filter((r) => {
      if (statusFilter.length > 0 && !statusFilter.includes(r.statusLabel)) return false;
      if (typeFilter.length > 0 && !typeFilter.includes(r.typeLabel)) return false;
      if (customerFilter.length > 0 && !customerFilter.includes(r.customerLabel)) return false;
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
  }, [enriched, search, statusFilter, typeFilter, customerFilter, delayedOnly, sort]);

  const hasActiveFilters =
    search.trim() !== "" || statusFilter.length > 0 || typeFilter.length > 0 || customerFilter.length > 0 || delayedOnly;

  function clearFilters() {
    setSearch("");
    setStatusFilter([]);
    setTypeFilter([]);
    setCustomerFilter([]);
    setDelayedOnly(false);
  }

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

      <section aria-label="Ready systems by product">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
          Ready by product
          <span className="ml-2 font-normal normal-case tracking-normal">
            {totalReady} system{totalReady === 1 ? "" : "s"} ready across {readyByProduct.length} product{readyByProduct.length === 1 ? "" : "s"}
          </span>
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {readyByProduct.map((p) => (
            <ReadyTile key={p.name} name={p.name} ready={p.ready} total={p.total} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <BarList title="By status" entries={byStatus} barClass="bg-primary-500" />
        <BarList title="By product type" entries={byType} barClass="bg-teal-500" />
        <BarList title="Production ready by month" entries={byMonth} barClass="bg-indigo-500" />
      </div>

      <section className="card relative z-20 border border-white/25 p-4 shadow-lg shadow-slate-950/5 dark:border-white/10">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
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
          <MultiSelect label="Status" allLabel="All statuses" options={statusOptions} selected={statusFilter} onChange={setStatusFilter} />
          <MultiSelect label="Product type" allLabel="All types" options={typeOptions} selected={typeFilter} onChange={setTypeFilter} />
          <MultiSelect label="Customer" allLabel="All customers" options={customerOptions} selected={customerFilter} onChange={setCustomerFilter} />
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Sort by</label>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="input-base">
              <option value="ready">Production ready date (soonest)</option>
              <option value="requested">Requested date (newest)</option>
              <option value="system">System ID</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={delayedOnly}
                onChange={(e) => setDelayedOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500/30"
              />
              Delayed only ({delayedCount})
            </label>
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="text-sm font-medium text-primary-700 hover:underline dark:text-sky-300">
                Clear all filters
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-300">Showing {visible.length} of {total} systems.</p>
        </div>
      </section>

      <div className="card overflow-hidden border border-white/25 shadow-lg shadow-slate-950/5 dark:border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/20 dark:divide-white/10">
            <caption className="sr-only">Production status by system</caption>
            <thead>
              <tr>
                {["System ID", "Product type", "Customer / inventory", "Status", "Requested", "Production Ready Date", "Delivered", "Remarks"].map((h) => (
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
                        {r.statusLabel}
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
