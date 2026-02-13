"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { asRolesArray } from "@/types/db";
import { useState, useEffect } from "react";

type ProfileOption = { id: string; profileName: string; roles: string[] };

type TopBarUserProps = {
  userEmail: string | null | undefined;
  userRoles: string[] | null | undefined;
  currentUserId?: string | null;
};

export function TopBarUser({ userEmail, userRoles, currentUserId }: TopBarUserProps) {
  const roles = asRolesArray(userRoles);
  const { update: updateSession } = useSession();
  const router = useRouter();
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
      router.refresh();
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div className="relative flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200 max-w-[180px]" title={userEmail ?? undefined}>
          {userEmail ?? "—"}
        </p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400 max-w-[180px]" title={roles.join(", ") || "No roles"}>
          {roles.length ? roles.join(", ") : "—"}
        </p>
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/25 bg-white/30 text-slate-600 transition hover:bg-white/50 dark:border-white/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
          aria-label="User menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-white/25 bg-white/95 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/95">
              <div className="border-b border-white/20 px-4 py-3 dark:border-white/10">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{userEmail ?? "—"}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {roles.length ? roles.join(", ") : "No roles"}
                </p>
              </div>
              {profiles.length > 1 && (
                <div className="border-b border-white/20 px-4 py-3 dark:border-white/10">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Profile</label>
                  <select
                    value={currentUserId ?? ""}
                    onChange={(e) => switchProfile(e.target.value)}
                    disabled={switching}
                    className="input-base w-full py-2 text-sm"
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.profileName} ({p.roles.join(", ")})
                      </option>
                    ))}
                  </select>
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
