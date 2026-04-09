import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import type { User } from "@/types/db";
import { asRolesArray } from "@/types/db";
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
  const rows = await query<User & { roles?: unknown; profile_name?: string }>(
    `SELECT id, email, profile_name AS "profile_name", name, roles, team, status, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM users ${where} ORDER BY created_at DESC`,
    args
  );
  const users: User[] = rows.map((u) => {
    const { profile_name, ...rest } = u;
    return { ...rest, profileName: profile_name ?? "Default", roles: asRolesArray(u.roles) };
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-600 dark:text-primary-300">Admin tools</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">User access & roles</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-200">
            Control who can sign in, which teams they belong to, and what approvals or operational work they can see in the platform.
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
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Total profiles</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{users.length}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">All active and disabled login profiles.</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Enabled</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700 dark:text-emerald-300">{users.filter((user) => user.status).length}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Profiles that can currently sign in.</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Role coverage</p>
          <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
            {Array.from(new Set(users.flatMap((user) => user.roles))).length} roles configured
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Quick access to requesters, approvers, finance, CDO, and procurement.</p>
        </div>
      </div>
      <UserManagement users={users} roleLabels={ROLE_LABELS} currentUserId={session?.user?.id} initialQuery={q} />
    </div>
  );
}
