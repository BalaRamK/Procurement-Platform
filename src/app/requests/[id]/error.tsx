"use client";

import Link from "next/link";

export default function RequestDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="card p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Something went wrong</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        We couldn’t load this request. It may have been deleted or you may not have access.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href="/dashboard" className="btn-secondary">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
