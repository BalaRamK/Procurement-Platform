"use client";

import Link from "next/link";

type PageHeaderProps = {
  backHref?: string;
  backLabel?: string;
  /** Optional right-side content (e.g. logo/brand) */
  right?: React.ReactNode;
};

export function PageHeader({
  backHref = "/dashboard",
  backLabel = "Back to Dashboard",
  right,
}: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-white/20 pb-4 dark:border-white/10">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
      >
        <span aria-hidden>←</span>
        {backLabel}
      </Link>
      {right ?? (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-600 text-xs font-semibold text-white shadow-lg shadow-primary-500/25">
            P
          </div>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Procurement
          </span>
        </div>
      )}
    </header>
  );
}
