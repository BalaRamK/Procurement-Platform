"use client";

import { useState } from "react";
import Link from "next/link";
import { User } from "@prisma/client";
import { UserRole, TeamName } from "@prisma/client";

type UserManagementProps = {
  users: (Pick<User, "id" | "email" | "name" | "role" | "team" | "status">)[];
  roleLabels: Record<UserRole, string>;
  currentUserId?: string;
};

const ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "REQUESTER",
  "FUNCTIONAL_HEAD",
  "L1_APPROVER",
  "CFO",
  "CDO",
  "PRODUCTION",
];

const TEAMS: { value: TeamName; label: string }[] = [
  { value: "INNOVATION", label: "Innovation" },
  { value: "ENGINEERING", label: "Engineering" },
  { value: "SALES", label: "Sales" },
];

export function UserManagement({ users: initialUsers, roleLabels, currentUserId }: UserManagementProps) {
  const [users, setUsers] = useState(initialUsers);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function updateRole(userId: string, role: UserRole) {
    setUpdating(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    } finally {
      setUpdating(null);
    }
  }

  async function updateTeam(userId: string, team: TeamName | null) {
    setUpdating(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, team }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, team } : u)));
    } finally {
      setUpdating(null);
    }
  }

  async function toggleStatus(userId: string, status: boolean) {
    setUpdating(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status } : u)));
    } finally {
      setUpdating(null);
    }
  }

  async function deleteUser(userId: string) {
    if (!confirm("Deactivate this user? They will no longer be able to sign in. You can re-enable them via Edit.")) return;
    setDeleting(userId);
    try {
      const res = await fetch(`/api/admin/users?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to delete");
      }
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete user");
    } finally {
      setDeleting(null);
    }
  }

  const showTeam = (role: UserRole) => role === "FUNCTIONAL_HEAD" || role === "L1_APPROVER";

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/20">
          <thead>
            <tr>
              <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Email</th>
              <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
              <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Role</th>
              <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Team</th>
              <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
              <th className="card-header px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/20 bg-white/25">
            {users.map((user) => (
              <tr key={user.id} className="table-row-glass transition-colors">
                <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-slate-900">{user.email}</td>
                <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">{user.name ?? "—"}</td>
                <td className="whitespace-nowrap px-5 py-4">
                  <select
                    value={user.role}
                    disabled={!!updating}
                    onChange={(e) => updateRole(user.id, e.target.value as UserRole)}
                    className="input-base w-auto min-w-[160px] py-2"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{roleLabels[r]}</option>
                    ))}
                  </select>
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  {showTeam(user.role) ? (
                    <select
                      value={user.team ?? ""}
                      disabled={!!updating}
                      onChange={(e) => updateTeam(user.id, e.target.value ? (e.target.value as TeamName) : null)}
                      className="input-base w-auto min-w-[120px] py-2"
                    >
                      <option value="">—</option>
                      {TEAMS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-slate-500">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <button
                    type="button"
                    disabled={!!updating}
                    onClick={() => toggleStatus(user.id, !user.status)}
                    className={`glass-panel px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50 ${
                      user.status ? "bg-emerald-400/20 text-emerald-800 border-emerald-400/30" : "bg-red-400/20 text-red-800 border-red-400/30"
                    }`}
                  >
                    {user.status ? "Enabled" : "Disabled"}
                  </button>
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/users/${user.id}/edit`}
                      className="text-sm font-medium text-primary-600 hover:text-primary-700"
                    >
                      Edit
                    </Link>
                    {currentUserId !== user.id && (
                      <button
                        type="button"
                        disabled={!!deleting}
                        onClick={() => deleteUser(user.id)}
                        className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        {deleting === user.id ? "…" : "Delete"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
