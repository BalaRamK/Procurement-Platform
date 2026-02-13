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
        <div className="sticky top-0 z-20 mx-auto max-w-4xl px-6 pt-6 pb-2">
          <div className="flex items-center justify-end">
            <TopBarUser userEmail={session.user.email} userRoles={session.user.roles} currentUserId={session.user.id} />
          </div>
        </div>
        <div className="mx-auto max-w-4xl px-6 pb-8">{children}</div>
      </main>
    </div>
  );
}
