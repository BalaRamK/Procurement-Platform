"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { asRolesArray } from "@/types/db";
import type { UserRole } from "@/types/db";
import { ROLE_LABELS } from "@/lib/constants";
import { useState, useEffect } from "react";

type ProfileOption = { id: string; profileName: string; roles: string[] };

type TopBarUserProps = {
  userEmail: string | null | undefined;
  userRoles: string[] | null | undefined;
  currentUserId?: string | null;
};

function roleLabel(r: string) {
  return ROLE_LABELS[r as UserRole] ?? r;
}

export function TopBarUser({ userEmail, userRoles, currentUserId }: TopBarUserProps) {
  const roles = asRolesArray(userRoles);
  const { update: updateSession } = useSession();
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [switching, setSwitching] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/profiles")
      .then((r) => r.json())
      .then((d) => setProfiles(d.profiles ?? []))
      .catch(() => setProfiles([]));
  }, [currentUserId]);

  async function switchProfile(userId: string) {
    if (userId === currentUserId || switching) return;
    setSwitching(true);
    setOpen(false);
    try {
      await updateSession({ selectedUserId: userId });
      window.location.reload();
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="relative flex items-center gap-4">
      <div className="hidden text-right sm:block">
        <p className="truncate text-base font-semibold text-slate-800 dark:text-slate-200 max-w-[240px]" title={userEmail ?? undefined}>
          {userEmail ?? "—"}
        </p>
        <div className="mt-0.5 flex flex-wrap justify-end gap-1 max-w-[240px]">
          {roles.length ? roles.map((r) => (
            <span key={r} className="inline-block rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
              {roleLabel(r)}
            </span>
          )) : <span className="text-xs text-slate-400">—</span>}
        </div>
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-slate-200/80 bg-white text-slate-600 shadow-sm transition hover:border-primary-300 hover:bg-slate-50 dark:border-slate-600/60 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:border-primary-500 dark:hover:bg-slate-700/80"
          aria-label="User menu"
          aria-expanded={open}
          aria-controls="user-menu-dropdown"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
            <div id="user-menu-dropdown" className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-white/25 bg-white/95 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/95">
              <div className="border-b border-white/20 px-4 py-3 dark:border-white/10">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{userEmail ?? "—"}</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {roles.length ? roles.map((r) => (
                    <span key={r} className="inline-block rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                      {roleLabel(r)}
                    </span>
                  )) : <span className="text-xs text-slate-400">No roles</span>}
                </div>
              </div>
              {profiles.length > 0 && (
                <div className="border-b border-white/20 px-4 py-3 dark:border-white/10">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Profile</label>
                  {profiles.length === 1 ? (
                    <div>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{profiles[0].profileName}</p>
                      <div className="flex flex-wrap gap-1">
                        {profiles[0].roles.map((r) => (
                          <span key={r} className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            {roleLabel(r)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {profiles.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => switchProfile(p.id)}
                          disabled={switching}
                          className={`w-full rounded-xl px-3 py-2 text-left transition ${
                            p.id === currentUserId
                              ? "bg-primary-50 ring-1 ring-primary-200 dark:bg-primary-900/30 dark:ring-primary-700"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800"
                          }`}
                        >
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{p.profileName}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {p.roles.map((r) => (
                              <span key={r} className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                {roleLabel(r)}
                              </span>
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="p-2">
                <Link
                  href="/api/auth/signout"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/30 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white/50 dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20"
                  onClick={() => setOpen(false)}
                >
                  Sign out
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
