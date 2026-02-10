import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { HeaderSearch } from "@/components/layout/HeaderSearch";

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
        <div className="sticky top-0 z-20 mx-auto max-w-6xl px-6 pt-6 pb-2">
          <div className="backdrop-liquid rounded-2xl border border-white/25 bg-white/30 px-4 py-2.5 shadow-[0_0_0_1px_rgba(255,255,255,0.45)_inset] dark:border-white/10 dark:bg-white/10 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]">
            <Suspense fallback={<input type="search" placeholder="Search users, templates, reports…" className="w-full bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none dark:text-slate-200 dark:placeholder-slate-400" readOnly aria-label="Search" />}>
              <HeaderSearch placeholder="Search users, templates, reports…" />
            </Suspense>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-6 pb-8">{children}</div>
      </main>
    </div>
  );
}
