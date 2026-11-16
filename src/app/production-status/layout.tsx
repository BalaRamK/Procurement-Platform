import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { userHasProductionStatusAccess } from "@/lib/production-status-access";
import { MobileLayoutShell } from "@/components/layout/MobileLayoutShell";
import { TopBarUserEnhanced } from "@/components/layout/TopBarUserEnhanced";

export default async function ProductionStatusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  if (!(await userHasProductionStatusAccess(session.user.id, session.user.roles))) redirect("/dashboard");

  return (
    <MobileLayoutShell
      userEmail={session.user.email}
      userRoles={session.user.roles}
      currentUserId={session.user.id}
      canViewProductionStatus
      headerSlot={
        <div className="flex flex-1 justify-end">
          <TopBarUserEnhanced userEmail={session.user.email} userRoles={session.user.roles} currentUserId={session.user.id} activeRole={session.user.activeRole} />
        </div>
      }
    >
      {children}
    </MobileLayoutShell>
  );
}
