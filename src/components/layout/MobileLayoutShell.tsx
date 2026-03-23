"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";

type MobileLayoutShellProps = {
  userEmail?: string | null;
  userRoles?: string[] | null;
  currentUserId?: string | null;
  headerSlot: React.ReactNode;
  children: React.ReactNode;
};

export function MobileLayoutShell({
  userEmail,
  userRoles,
  currentUserId,
  headerSlot,
  children,
}: MobileLayoutShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="relative z-10 flex min-h-screen">
      <AppSidebar
        userEmail={userEmail}
        userRoles={userRoles}
        currentUserId={currentUserId}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <main className="flex-1 overflow-auto" id="main-content">
        <header className="sticky top-0 z-20 border-b border-slate-200/90 bg-white/95 shadow-sm backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4 sm:px-6">
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-600/60 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700/80 md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {headerSlot}
          </div>
        </header>
        <div className="mx-auto max-w-6xl px-4 py-6 pb-8 sm:px-6">{children}</div>
      </main>
    </div>
  );
}
