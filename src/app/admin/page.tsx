import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { UserManagement } from "@/components/admin/UserManagement";
import { ROLE_LABELS } from "@/lib/constants";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Add, edit, or delete users. Edit email, name, role, team, and status. Delete deactivates the user (they cannot sign in).
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/reports" className="btn-secondary">
            Reports & SLA
          </Link>
          <Link href="/admin/email-templates" className="btn-secondary">
            Email templates
          </Link>
          <Link href="/admin/users/new" className="btn-primary">
            Add user
          </Link>
        </div>
      </div>
      <UserManagement users={users} roleLabels={ROLE_LABELS} currentUserId={session?.user?.id} />
    </div>
  );
}
