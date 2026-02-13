import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { TopBarUser } from "@/components/layout/TopBarUser";

export default async function RequestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  return (
    <div className="relative z-10 flex min-h-screen">
      <AppSidebar userEmail={session.user.email} userRoles={session.user.roles} currentUserId={session.user.id} />
      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-20 border-b border-slate-200/90 bg-white/95 shadow-sm backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-4xl items-center justify-end px-6 py-4">
            <TopBarUser userEmail={session.user.email} userRoles={session.user.roles} currentUserId={session.user.id} />
          </div>
        </header>
        <div className="mx-auto max-w-4xl px-6 py-6 pb-8">{children}</div>
      </main>
    </div>
  );
}
