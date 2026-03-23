type Step = { key: string; label: string };

const STEPS: Step[] = [
  { key: "DRAFT", label: "Draft" },
  { key: "PENDING_FH_APPROVAL", label: "Dept Head" },
  { key: "PENDING_L1_APPROVAL", label: "L1 Approval" },
  { key: "PENDING_CFO_APPROVAL", label: "CFO" },
  { key: "PENDING_CDO_APPROVAL", label: "CDO" },
  { key: "ASSIGNED_TO_PRODUCTION", label: "Production" },
  { key: "DELIVERED_TO_REQUESTER", label: "Delivered" },
  { key: "CONFIRMED_BY_REQUESTER", label: "Confirmed" },
  { key: "CLOSED", label: "Closed" },
];

const SALES_STEPS: Step[] = [
  { key: "DRAFT", label: "Draft" },
  { key: "PENDING_L1_APPROVAL", label: "L1 Approval" },
  { key: "PENDING_CFO_APPROVAL", label: "CFO" },
  { key: "PENDING_CDO_APPROVAL", label: "CDO" },
  { key: "ASSIGNED_TO_PRODUCTION", label: "Production" },
  { key: "DELIVERED_TO_REQUESTER", label: "Delivered" },
  { key: "CONFIRMED_BY_REQUESTER", label: "Confirmed" },
  { key: "CLOSED", label: "Closed" },
];

export function WorkflowStepper({ status, teamName }: { status: string; teamName?: string }) {
  if (status === "REJECTED") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-200/50 bg-red-50/60 px-4 py-3 dark:border-red-800/40 dark:bg-red-950/30">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">✕</span>
        <span className="text-sm font-medium text-red-700 dark:text-red-300">Request rejected</span>
      </div>
    );
  }

  const steps = teamName === "SALES" ? SALES_STEPS : STEPS;
  const activeIdx = steps.findIndex((s) => s.key === status);

  return (
    <nav aria-label="Request workflow progress">
      <ol className="flex items-center overflow-x-auto">
        {steps.map((step, idx) => {
          const done = activeIdx > idx;
          const active = activeIdx === idx;
          return (
            <li key={step.key} className="flex min-w-0 flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    done
                      ? "bg-primary-500 text-white"
                      : active
                        ? "ring-2 ring-primary-500 bg-white text-primary-600 dark:bg-slate-900 dark:text-primary-400"
                        : "bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500"
                  }`}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? "✓" : idx + 1}
                </span>
                <span
                  className={`hidden whitespace-nowrap text-[10px] font-medium sm:block ${
                    active ? "text-primary-600 dark:text-primary-400" : done ? "text-slate-600 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`mx-1 h-0.5 flex-1 ${done ? "bg-primary-400" : "bg-slate-200 dark:bg-slate-700"}`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
