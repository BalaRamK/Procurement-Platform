import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { MobileLayoutShell } from "@/components/layout/MobileLayoutShell";
import { TopBarUser } from "@/components/layout/TopBarUser";

export default async function RequestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  return (
    <MobileLayoutShell
      userEmail={session.user.email}
      userRoles={session.user.roles}
      currentUserId={session.user.id}
      headerSlot={
        <div className="flex flex-1 justify-end">
          <TopBarUser userEmail={session.user.email} userRoles={session.user.roles} currentUserId={session.user.id} />
        </div>
      }
    >
      {children}
    </MobileLayoutShell>
  );
}
