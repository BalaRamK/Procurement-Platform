import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { AddUserForm } from "@/components/admin/AddUserForm";
import Link from "next/link";
import { ROLE_LABELS } from "@/lib/constants";
import type { UserRole } from "@prisma/client";

const ROLES: UserRole[] = [
  "REQUESTER",
  "FUNCTIONAL_HEAD",
  "L1_APPROVER",
  "CFO",
  "CDO",
  "PRODUCTION",
  "SUPER_ADMIN",
];

export default async function AddUserPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "SUPER_ADMIN") redirect("/dashboard");

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Back to User management
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Add user</h1>
        <p className="mt-1 text-sm text-slate-500">
          Add a user by email and assign a role. When they sign in with Azure AD (corporate email), they will get this role. Use corporate email IDs only.
        </p>
      </div>
      <AddUserForm roles={ROLES} roleLabels={ROLE_LABELS} />
    </div>
  );
}
