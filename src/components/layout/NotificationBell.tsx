"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type NotificationItem = {
  id: string;
  type: string;
  sentAt: string;
  ticket: { id: string; title: string; requestId: string | null; status: string } | null;
};

const TYPE_LABELS: Record<string, string> = {
  on_creation: "Request created",
  assignment: "Assigned",
  delivered: "Delivered",
  closure: "Closed",
  team_assignment: "Team assignment",
  comment_mention: "Mentioned you in a comment",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  const count = list.length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-white/25 bg-white/30 text-slate-600 transition hover:bg-white/50 dark:border-white/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
        aria-label="Notifications"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-medium text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-white/25 bg-white/95 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/95">
            <div className="card-header border-b border-white/20 px-4 py-3 dark:border-white/10">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</h3>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading…</p>
              ) : list.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">No notifications yet.</p>
              ) : (
                list.map((n) => (
                  <Link
                    key={n.id}
                    href={n.ticket ? `/requests/${n.ticket.id}` : "/dashboard"}
                    onClick={() => setOpen(false)}
                    className="block border-b border-white/15 px-4 py-3 transition hover:bg-white/50 dark:border-white/10 dark:hover:bg-white/10"
                  >
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {TYPE_LABELS[n.type] ?? n.type}
                    </p>
                    {n.ticket && (
                      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                        {n.ticket.requestId ? `${n.ticket.requestId} · ` : ""}{n.ticket.title}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                      {new Date(n.sentAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
