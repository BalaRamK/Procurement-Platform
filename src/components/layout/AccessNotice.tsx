"use client";

import { useSearchParams } from "next/navigation";

export function AccessNotice() {
  const params = useSearchParams();
  if (params.get("notice") !== "no-access") return null;
  return (
    <div
      role="alert"
      className="mb-4 rounded-2xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100"
    >
      You don&apos;t have access to that request with your current role. Requests are visible to approvers only while
      they are at their stage, unless you acted on them or were mentioned in a comment. If you hold more than one role,
      try switching roles.
    </div>
  );
}
