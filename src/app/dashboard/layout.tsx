import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { AppSidebar } from "@/components/layout/AppSidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  return (
    <div className="relative z-10 flex min-h-screen">
      <AppSidebar userEmail={session.user.email} userRole={session.user.role} />
      <main className="flex-1 overflow-auto">
        <div className="sticky top-0 z-20 mx-auto max-w-6xl px-6 pt-6 pb-2">
          <div className="backdrop-liquid rounded-2xl border border-white/25 bg-white/30 px-4 py-2.5 shadow-[0_0_0_1px_rgba(255,255,255,0.45)_inset]">
            <input
              type="search"
              placeholder="Search requests, tickets…"
              className="w-full bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
              aria-label="Search"
            />
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-6 pb-8">{children}</div>
      </main>
    </div>
  );
}
