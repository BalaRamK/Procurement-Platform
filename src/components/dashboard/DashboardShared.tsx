"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function formatShortDate(value: string | Date) {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function DashboardHero({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/30 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_28%),rgba(255,255,255,0.62)] p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_28%),rgba(15,23,42,0.55)] md:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-600 dark:text-primary-300">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
        </div>
        {action ? <div className="flex shrink-0 items-center gap-3">{action}</div> : null}
      </div>
    </section>
  );
}

export function MetricTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint: string;
  tone?: "default" | "success" | "warning" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-300/40 bg-emerald-50/80 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-950/20 dark:text-emerald-200"
      : tone === "warning"
        ? "border-amber-300/40 bg-amber-50/80 text-amber-900 dark:border-amber-500/20 dark:bg-amber-950/20 dark:text-amber-200"
        : tone === "info"
          ? "border-sky-300/40 bg-sky-50/80 text-sky-900 dark:border-sky-500/20 dark:bg-sky-950/20 dark:text-sky-200"
          : "border-white/30 bg-white/55 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100";

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-current/70">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-current/70">{hint}</p>
    </div>
  );
}

export function PriorityPill({ priority }: { priority: string | null | undefined }) {
  const toneClass =
    priority === "URGENT"
      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
      : priority === "HIGH"
        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
        : priority === "MEDIUM"
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";

  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${toneClass}`}>{String(priority ?? "-")}</span>;
}

export function EmptyDashboardState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="font-medium text-slate-700 dark:text-slate-200">{title}</p>
      <p className="max-w-xl text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="btn-primary mt-1 inline-flex">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
