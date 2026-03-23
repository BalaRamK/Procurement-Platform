import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { MobileLayoutShell } from "@/components/layout/MobileLayoutShell";
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
    <MobileLayoutShell
      userEmail={session.user.email}
      userRoles={session.user.roles}
      currentUserId={session.user.id}
      headerSlot={
        <>
          <div className="backdrop-liquid flex-1 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 shadow-sm dark:border-slate-600/50 dark:bg-slate-800/50">
            <Suspense fallback={<input type="search" placeholder="Search users, templates, reports…" className="w-full bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none dark:text-slate-200 dark:placeholder-slate-400" readOnly aria-label="Search" />}>
              <HeaderSearch placeholder="Search users, templates, reports…" />
            </Suspense>
          </div>
          <TopBarUser userEmail={session.user.email} userRoles={session.user.roles} currentUserId={session.user.id} />
        </>
      }
    >
      {children}
    </MobileLayoutShell>
  );
}
