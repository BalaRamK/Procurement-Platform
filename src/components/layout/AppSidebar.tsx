"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { asRolesArray } from "@/types/db";

type AppSidebarProps = {
  userEmail?: string | null;
  userRoles?: string[] | null;
  currentUserId?: string | null;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function AppSidebar({ userRoles, userEmail, mobileOpen, onMobileClose }: AppSidebarProps) {
  const roles = asRolesArray(userRoles);
  const isSuperAdmin = roles.includes("SUPER_ADMIN");
  const pathname = usePathname();
  const roleSummary = roles.length > 0 ? roles.join(" | ").replaceAll("_", " ") : "Workspace";

  const navLink = (href: string) => (pathname === href ? "nav-link nav-link-active" : "nav-link");

  const navContent = (
    <>
      <div className="flex h-16 items-center justify-between gap-3 border-b border-white/25 px-6 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-600 text-sm font-semibold text-white shadow-lg shadow-primary-500/30">
            P
          </div>
          <span className="text-base font-semibold text-slate-900 dark:text-slate-100">Procurement</span>
        </div>
        <ThemeToggle />
      </div>
      <div className="border-b border-white/15 px-4 py-4 dark:border-white/10">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Active roles</p>
        <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">{roleSummary}</p>
      </div>
      <nav className="flex-1 space-y-6 p-4" role="navigation" aria-label="Main navigation">
        <div className="space-y-1.5">
          <p className="px-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">My work</p>
          <Link href="/dashboard" className={navLink("/dashboard")} onClick={onMobileClose}>
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Dashboard
          </Link>
          <Link href="/dashboard/pending" className={navLink("/dashboard/pending")} onClick={onMobileClose}>
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Pending queue
          </Link>
          <Link href="/requests/new" className={navLink("/requests/new")} onClick={onMobileClose}>
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New request
          </Link>
        </div>
      {isSuperAdmin && (
        <div className="space-y-1.5">
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Admin tools</p>
            <Link href="/admin" className={navLink("/admin")} onClick={onMobileClose}>
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              User access
            </Link>
            <Link href="/admin/users/new" className={navLink("/admin/users/new")} onClick={onMobileClose}>
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Add user
            </Link>
            <Link href="/admin/reports" className={navLink("/admin/reports")} onClick={onMobileClose}>
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Reports & SLA
            </Link>
            <Link href="/admin/email-templates" className={navLink("/admin/email-templates")} onClick={onMobileClose}>
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Emails & delivery
            </Link>
            <Link href="/admin/request-options" className={navLink("/admin/request-options")} onClick={onMobileClose}>
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
              </svg>
              Request options
            </Link>
          </div>
        )}
      <div className="mt-auto border-t border-white/15 px-4 py-4 dark:border-white/10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          Signed in as
        </p>
        <p className="mt-2 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
          {userEmail ?? "Active session"}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{roleSummary}</p>
      </div>
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sidebar-glass hidden md:flex w-64 flex-col rounded-r-3xl border-r border-white/25 dark:border-white/10">
        {navContent}
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
            aria-hidden
            onClick={onMobileClose}
          />
          <aside className="sidebar-glass fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/25 dark:border-white/10 md:hidden">
            {navContent}
          </aside>
        </>
      )}
    </>
  );
}

