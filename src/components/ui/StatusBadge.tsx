"use client";

import { STATUS_LABELS } from "@/lib/constants";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-400/20 text-slate-700 border-slate-300/40",
  PENDING_FH_APPROVAL: "bg-amber-400/20 text-amber-800 border-amber-400/30",
  PENDING_L1_APPROVAL: "bg-amber-400/20 text-amber-800 border-amber-400/30",
  PENDING_CFO_APPROVAL: "bg-amber-400/20 text-amber-800 border-amber-400/30",
  PENDING_CDO_APPROVAL: "bg-amber-400/20 text-amber-800 border-amber-400/30",
  ASSIGNED_TO_PRODUCTION: "bg-primary-400/20 text-primary-800 border-primary-400/30",
  DELIVERED_TO_REQUESTER: "bg-blue-400/20 text-blue-800 border-blue-400/30",
  CONFIRMED_BY_REQUESTER: "bg-emerald-400/20 text-emerald-800 border-emerald-400/30",
  CLOSED: "bg-slate-400/15 text-slate-600 border-slate-300/30",
  REJECTED: "bg-red-400/20 text-red-800 border-red-400/30",
};

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const className = STATUS_STYLES[status] ?? "bg-slate-400/20 text-slate-700 border-slate-300/40";
  const displayLabel = label ?? STATUS_LABELS[status] ?? status;
  return (
    <span className={`glass-panel inline-flex items-center px-2.5 py-1 text-xs font-medium ${className}`}>
      {displayLabel}
    </span>
  );
}
