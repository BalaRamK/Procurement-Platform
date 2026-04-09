"use client";

import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

type MetricCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "success" | "warning" | "info";
};

type PillProps = {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "info" | "danger";
  className?: string;
};

export type TabItem = {
  id: string;
  label: string;
  count?: number;
};

type TabBarProps = {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
};

type EmptyStateCardProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

const pillStyles: Record<NonNullable<PillProps["tone"]>, string> = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  success: "border-emerald-300/40 bg-emerald-100/40 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-300",
  warning: "border-amber-300/50 bg-amber-100/50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-300",
  info: "border-primary-300/40 bg-primary-100/35 text-primary-800 dark:border-primary-500/30 dark:bg-primary-900/20 dark:text-primary-300",
  danger: "border-red-300/40 bg-red-100/40 text-red-800 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-300",
};

const metricStyles: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  default: "border-white/30 bg-white/65 text-slate-900 dark:border-white/10 dark:bg-slate-900/40 dark:text-white",
  success: "border-emerald-300/40 bg-emerald-50/80 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-950/20 dark:text-emerald-200",
  warning: "border-amber-300/40 bg-amber-50/80 text-amber-900 dark:border-amber-500/20 dark:bg-amber-950/20 dark:text-amber-200",
  info: "border-primary-300/40 bg-primary-50/80 text-primary-900 dark:border-primary-500/20 dark:bg-primary-950/20 dark:text-primary-200",
};

export function SectionCard({ title, description, actions, children, className = "", bodyClassName = "" }: SectionCardProps) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      <div className="card-header flex flex-wrap items-start justify-between gap-4 border-b px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
          {description ? <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-200">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
      </div>
      <div className={`px-6 py-6 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function MetricCard({ label, value, hint, tone = "default" }: MetricCardProps) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${metricStyles[tone]}`}>
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-current/70">{label}</p>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {hint ? <p className="mt-1 text-sm text-current/70">{hint}</p> : null}
    </div>
  );
}

export function Pill({ children, tone = "neutral", className = "" }: PillProps) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${pillStyles[tone]} ${className}`.trim()}>
      {children}
    </span>
  );
}

export function TabBar({ tabs, activeId, onChange }: TabBarProps) {
  return (
    <div className="rounded-3xl border border-white/30 bg-white/55 p-1.5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/35">
      <div className="grid gap-1 sm:grid-cols-3">
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`rounded-2xl px-4 py-3 text-left transition ${
                active
                  ? "bg-primary-600 text-white shadow-lg shadow-primary-600/20"
                  : "bg-transparent text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{tab.label}</span>
                {typeof tab.count === "number" ? (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                    {tab.count}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function EmptyStateCard({ title, description, action }: EmptyStateCardProps) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white/55 px-6 py-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/30">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-300">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
