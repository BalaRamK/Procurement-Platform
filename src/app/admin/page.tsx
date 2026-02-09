import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import type { User } from "@/types/db";
import { UserManagement } from "@/components/admin/UserManagement";
import { ROLE_LABELS } from "@/lib/constants";

export default async function AdminUsersPage({
  searchParams = {},
}: {
  searchParams?: Promise<{ q?: string }> | { q?: string };
}) {
  const session = await getServerSession(authOptions);
  const resolved = searchParams && typeof (searchParams as Promise<unknown>).then === "function"
    ? await (searchParams as Promise<{ q?: string }>)
    : (searchParams as { q?: string }) ?? {};
  const q = (resolved.q ?? "").trim();
  const where = q ? `WHERE (email ILIKE $1 OR name ILIKE $1)` : "";
  const args = q ? [`%${q}%`] : [];
  const users = await query<User>(
    `SELECT id, email, name, roles, team, status, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM users ${where} ORDER BY created_at DESC`,
    args
  );

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">User management</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-200">
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
