import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { HeaderSearch } from "@/components/layout/HeaderSearch";
import { TopBarUser } from "@/components/layout/TopBarUser";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  if (!session.user.roles?.includes("SUPER_ADMIN")) redirect("/dashboard");

  return (
    <div className="relative z-10 flex min-h-screen">
      <AppSidebar userEmail={session.user.email} userRoles={session.user.roles} currentUserId={session.user.id} />
      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-20 border-b border-slate-200/90 bg-white/95 shadow-sm backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4">
            <div className="backdrop-liquid flex-1 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 shadow-sm dark:border-slate-600/50 dark:bg-slate-800/50">
              <Suspense fallback={<input type="search" placeholder="Search users, templates, reports…" className="w-full bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none dark:text-slate-200 dark:placeholder-slate-400" readOnly aria-label="Search" />}>
                <HeaderSearch placeholder="Search users, templates, reports…" />
              </Suspense>
            </div>
            <TopBarUser userEmail={session.user.email} userRoles={session.user.roles} currentUserId={session.user.id} />
          </div>
        </header>
        <div className="mx-auto max-w-6xl px-6 py-6 pb-8">{children}</div>
      </main>
    </div>
  );
}
