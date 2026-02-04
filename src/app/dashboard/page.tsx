import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { RequesterDashboard } from "@/components/dashboard/RequesterDashboard";
import { ApproverDashboard } from "@/components/dashboard/ApproverDashboard";
import { ProductionDashboard } from "@/components/dashboard/ProductionDashboard";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

const APPROVER_ROLES: UserRole[] = [
  "FUNCTIONAL_HEAD",
  "L1_APPROVER",
  "CFO",
  "CDO",
];

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const role = session.user.role ?? "REQUESTER";
  const userTeam = session.user.team ?? null;

  if (role === "REQUESTER") {
    const tickets = await prisma.ticket.findMany({
      where: { requesterId: session.user.id },
      orderBy: { updatedAt: "desc" },
    });
    return <RequesterDashboard tickets={tickets} />;
  }

  if (role === "FUNCTIONAL_HEAD" && userTeam) {
    const tickets = await prisma.ticket.findMany({
      where: { status: "PENDING_FH_APPROVAL", teamName: userTeam },
      include: { requester: true },
      orderBy: { updatedAt: "desc" },
    });
    return <ApproverDashboard tickets={tickets} role={role} teamName={userTeam} />;
  }

  if (role === "L1_APPROVER" && userTeam) {
    const tickets = await prisma.ticket.findMany({
      where: { status: "PENDING_L1_APPROVAL", teamName: userTeam },
      include: { requester: true },
      orderBy: { updatedAt: "desc" },
    });
    return <ApproverDashboard tickets={tickets} role={role} teamName={userTeam} />;
  }

  if (role === "CFO") {
    const tickets = await prisma.ticket.findMany({
      where: { status: "PENDING_CFO_APPROVAL" },
      include: { requester: true },
      orderBy: { updatedAt: "desc" },
    });
    return <ApproverDashboard tickets={tickets} role={role} />;
  }

  if (role === "CDO") {
    const tickets = await prisma.ticket.findMany({
      where: { status: "PENDING_CDO_APPROVAL" },
      include: { requester: true },
      orderBy: { updatedAt: "desc" },
    });
    return <ApproverDashboard tickets={tickets} role={role} />;
  }

  if (role === "PRODUCTION") {
    const tickets = await prisma.ticket.findMany({
      where: {
        status: { in: ["ASSIGNED_TO_PRODUCTION", "DELIVERED_TO_REQUESTER"] },
      },
      include: { requester: true },
      orderBy: { updatedAt: "desc" },
    });
    return <ProductionDashboard tickets={tickets} />;
  }

  if (role === "SUPER_ADMIN") {
    const tickets = await prisma.ticket.findMany({
      include: { requester: true },
      orderBy: { updatedAt: "desc" },
    });
    return <RequesterDashboard tickets={tickets} showAll showNewRequestButton />;
  }

  return (
    <div className="card p-6 text-amber-800 backdrop-blur-md dark:text-amber-200">
      No dashboard configured for your role. Contact an administrator.
    </div>
  );
}
