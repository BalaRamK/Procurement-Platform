import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EditUserForm } from "@/components/admin/EditUserForm";
import Link from "next/link";
import { ROLE_LABELS } from "@/lib/constants";
import type { UserRole } from "@/types/db";

const ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "REQUESTER",
  "FUNCTIONAL_HEAD",
  "L1_APPROVER",
  "CFO",
  "CDO",
  "PRODUCTION",
];

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, team: true, status: true },
  });
  if (!user) notFound();

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Back to User management
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Edit user</h1>
        <p className="mt-1 text-sm text-slate-500">
          Update email, name, role, team, or status. Disabled users cannot sign in.
        </p>
      </div>
      <EditUserForm user={user} roleLabels={ROLE_LABELS} roles={ROLES} />
    </div>
  );
}
