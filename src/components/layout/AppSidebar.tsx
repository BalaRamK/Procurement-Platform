"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { asRolesArray } from "@/types/db";
import { useState, useEffect } from "react";

type ProfileOption = { id: string; profileName: string; roles: string[] };

type AppSidebarProps = {
  userEmail: string | null | undefined;
  userRoles: string[] | null | undefined;
  currentUserId?: string | null;
};

export function AppSidebar({ userEmail, userRoles, currentUserId }: AppSidebarProps) {
  const roles = asRolesArray(userRoles);
  const isSuperAdmin = roles.includes("SUPER_ADMIN");
  const pathname = usePathname();
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    fetch("/api/auth/profiles")
      .then((r) => r.json())
      .then((d) => setProfiles(d.profiles ?? []))
      .catch(() => setProfiles([]));
  }, [currentUserId]);

  async function switchProfile(userId: string) {
    if (userId === currentUserId || switching) return;
    setSwitching(true);
    try {
      await updateSession({ selectedUserId: userId });
      router.refresh();
    } finally {
      setSwitching(false);
    }
  }

  return (
    <aside className="sidebar-glass flex w-64 flex-col rounded-r-3xl border-r border-white/25 dark:border-white/10">
      <div className="flex h-16 items-center justify-between gap-3 border-b border-white/25 px-6 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-600 text-sm font-semibold text-white shadow-lg shadow-primary-500/30">
            P
          </div>
          <span className="text-base font-semibold text-slate-900 dark:text-slate-100">Procurement</span>
        </div>
        <ThemeToggle />
      </div>
      <nav className="flex-1 space-y-0.5 p-3">
        <Link
          href="/dashboard"
          className={pathname === "/dashboard" ? "nav-link nav-link-active" : "nav-link"}
        >
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          Dashboard
        </Link>
        <Link
          href="/dashboard/pending"
          className={pathname === "/dashboard/pending" ? "nav-link nav-link-active" : "nav-link"}
        >
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Pending approvals
        </Link>
        <Link
          href="/requests/new"
          className={pathname === "/requests/new" ? "nav-link nav-link-active" : "nav-link"}
        >
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New request
        </Link>
        {isSuperAdmin && (
          <>
            <Link
              href="/admin"
              className={pathname === "/admin" ? "nav-link nav-link-active" : "nav-link"}
            >
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              User management
            </Link>
            <Link
              href="/admin/users/new"
              className={pathname === "/admin/users/new" ? "nav-link nav-link-active" : "nav-link"}
            >
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Add user
            </Link>
            <Link
              href="/admin/reports"
              className={pathname === "/admin/reports" ? "nav-link nav-link-active" : "nav-link"}
            >
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Reports & SLA
            </Link>
            <Link
              href="/admin/email-templates"
              className={pathname === "/admin/email-templates" ? "nav-link nav-link-active" : "nav-link"}
            >
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email templates
            </Link>
          </>
        )}
      </nav>
      <div className="border-t border-white/25 p-3 dark:border-white/10">
        <div className="glass-panel px-3 py-2.5">
          <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-300">Signed in as</p>
          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{userEmail ?? "—"}</p>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400" title={roles.join(", ") || "No roles"}>
            Roles: {roles.length ? roles.join(", ") : "—"}
          </p>
          {profiles.length > 1 && (
            <div className="mt-2">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Profile</label>
              <select
                value={currentUserId ?? ""}
                onChange={(e) => switchProfile(e.target.value)}
                disabled={switching}
                className="input-base w-full py-1.5 text-sm"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.profileName} ({p.roles.join(", ")})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <Link href="/api/auth/signout" className="btn-secondary mt-2 flex w-full items-center justify-center gap-2">
          Sign out
        </Link>
      </div>
    </aside>
  );
}
