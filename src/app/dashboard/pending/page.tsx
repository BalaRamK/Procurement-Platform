import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { RequesterDashboard } from "@/components/dashboard/RequesterDashboard";
import { ApproverDashboard } from "@/components/dashboard/ApproverDashboard";
import { ProductionDashboard } from "@/components/dashboard/ProductionDashboard";
import { prisma } from "@/lib/prisma";

export default async function PendingApprovalsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth/signin");

  const role = session.user.role ?? "REQUESTER";
  const userTeam = session.user.team ?? null;

  // Requester: drafts + delivered (pending confirm)
  if (role === "REQUESTER") {
    const tickets = await prisma.ticket.findMany({
      where: {
        requesterId: session.user.id,
        status: { in: ["DRAFT", "DELIVERED_TO_REQUESTER"] },
      },
      orderBy: { updatedAt: "desc" },
    });
    return (
      <RequesterDashboard
        tickets={tickets}
        title="Pending your action"
        subtitle="Drafts to submit or delivered requests waiting for your confirmation."
      />
    );
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

  // Super Admin: all in-progress (not draft, not closed/rejected)
  if (role === "SUPER_ADMIN") {
    const tickets = await prisma.ticket.findMany({
      where: {
        status: {
          notIn: ["DRAFT", "CLOSED", "REJECTED", "CONFIRMED_BY_REQUESTER"],
        },
      },
      include: { requester: true },
      orderBy: { updatedAt: "desc" },
    });
    return (
      <RequesterDashboard
        tickets={tickets}
        showAll
        title="Pending (all in progress)"
        subtitle="All tickets currently in the approval or production pipeline."
      />
    );
  }

  return (
    <div className="card p-6 text-slate-600 backdrop-blur-md">
      No pending view for your role. Use <a href="/dashboard" className="text-primary-600 hover:underline">Dashboard</a>.
    </div>
  );
}
