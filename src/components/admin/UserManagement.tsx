"use client";

import { useState } from "react";
import Link from "next/link";
import type { User, UserRole, TeamName } from "@/types/db";
import { asRolesArray } from "@/types/db";

type UserManagementProps = {
  users: (Pick<User, "id" | "email" | "profileName" | "name" | "roles" | "team" | "status">)[];
  roleLabels: Record<UserRole, string>;
  currentUserId?: string;
  initialQuery?: string;
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

const TEAM_LABELS: Record<TeamName, string> = {
  INNOVATION: "Innovation",
  ENGINEERING: "Engineering",
  SALES: "Sales",
};

function roleTone(role: UserRole) {
  switch (role) {
    case "SUPER_ADMIN":
      return "bg-slate-100 text-slate-800 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-100 dark:ring-slate-400/20";
    case "REQUESTER":
      return "bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-100 dark:ring-sky-400/20";
    case "FUNCTIONAL_HEAD":
      return "bg-indigo-100 text-indigo-800 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-100 dark:ring-indigo-400/20";
    case "L1_APPROVER":
      return "bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-400/20";
    case "CFO":
      return "bg-emerald-100 text-emerald-900 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-100 dark:ring-emerald-400/20";
    case "CDO":
      return "bg-rose-100 text-rose-900 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-100 dark:ring-rose-400/20";
    case "PRODUCTION":
      return "bg-teal-100 text-teal-900 ring-teal-200 dark:bg-teal-500/15 dark:text-teal-100 dark:ring-teal-400/20";
    default:
      return "bg-slate-100 text-slate-800 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-100 dark:ring-slate-400/20";
  }
}

export function UserManagement({ users: initialUsers, roleLabels, currentUserId, initialQuery = "" }: UserManagementProps) {
  const [users, setUsers] = useState(initialUsers);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState(initialQuery);
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [teamFilter, setTeamFilter] = useState<TeamName | "all" | "none">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const normalizedSearch = search.trim().toLowerCase();
  const visibleUsers = users.filter((user) => {
    const roles = asRolesArray(user.roles);
    const searchable = [
      user.email,
      user.profileName ?? "",
      user.name ?? "",
      user.team ? TEAM_LABELS[user.team] : "",
      ...roles.map((role) => roleLabels[role]),
    ]
      .join(" ")
      .toLowerCase();

    if (normalizedSearch && !searchable.includes(normalizedSearch)) return false;
    if (roleFilter !== "all" && !roles.includes(roleFilter)) return false;
    if (statusFilter === "active" && !user.status) return false;
    if (statusFilter === "inactive" && user.status) return false;
    if (teamFilter === "none" && user.team) return false;
    if (teamFilter !== "all" && teamFilter !== "none" && user.team !== teamFilter) return false;
    return true;
  });

  const hasActiveFilters =
    normalizedSearch.length > 0 || roleFilter !== "all" || teamFilter !== "all" || statusFilter !== "all";

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
    if (!confirm("Deactivate this user? They will no longer be able to sign in. You can re-enable them later.")) return;
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

  const showTeam = (roles: UserRole[]) =>
    roles?.includes("FUNCTIONAL_HEAD") || roles?.includes("L1_APPROVER");

  function resetFilters() {
    setSearch("");
    setRoleFilter("all");
    setTeamFilter("all");
    setStatusFilter("all");
  }

  return (
    <div className="space-y-4">
      <section className="card border border-white/25 p-4 shadow-lg shadow-slate-950/5 dark:border-white/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
              Access filters
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Search by email, name, profile, team, or role. Narrow the list before editing access.
            </p>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
            className="btn-secondary disabled:opacity-50"
          >
            Reset filters
          </button>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">
              Search
            </label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-base"
              placeholder="Search email, name, profile, role, or team"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">
              Role
            </label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRole | "all")}
              className="input-base"
            >
              <option value="all">All roles</option>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
              className="input-base"
            >
              <option value="all">All statuses</option>
              <option value="active">Enabled</option>
              <option value="inactive">Disabled</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">
              Team
            </label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value as TeamName | "all" | "none")}
              className="input-base"
            >
              <option value="all">All teams</option>
              <option value="none">No team</option>
              {TEAMS.map((team) => (
                <option key={team.value} value={team.value}>
                  {team.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">
          Showing {visibleUsers.length} of {users.length} users.
        </p>
      </section>

      <div className="card overflow-hidden border border-white/25 shadow-lg shadow-slate-950/5 dark:border-white/10">
        <div className="overflow-x-auto">
        <table className="min-w-full table-fixed divide-y divide-white/20 dark:divide-white/10">
          <caption className="sr-only">User management</caption>
          <thead>
            <tr>
              <th scope="col" className="card-header w-[18%] px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">User</th>
              <th scope="col" className="card-header w-[9rem] px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Access profile</th>
              <th scope="col" className="card-header w-[12%] px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Display name</th>
              <th scope="col" className="card-header w-[28%] px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Roles</th>
              <th scope="col" className="card-header w-[9rem] px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Team</th>
              <th scope="col" className="card-header w-[8rem] px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Status</th>
              <th scope="col" className="card-header sticky right-0 z-10 w-[11rem] px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 backdrop-blur dark:text-slate-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/20 bg-white/25 dark:bg-white/5">
            {visibleUsers.map((user) => (
              <tr key={user.id} className="table-row-glass transition-colors">
                <td className="px-4 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                  <div className="max-w-[14rem] break-words leading-5">{user.email}</div>
                </td>
                <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-200">{user.profileName ?? "Default"}</td>
                <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-200">
                  <div className="max-w-[10rem] break-words leading-5">{user.name ?? "-"}</div>
                </td>
                <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-200">
                  <div className="flex flex-wrap gap-2">
                    {asRolesArray(user.roles).length > 0 ? (
                      asRolesArray(user.roles).map((role) => (
                        <span
                          key={role}
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${roleTone(role)}`}
                        >
                          {roleLabels[role]}
                        </span>
                      ))
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4">
                  {showTeam(asRolesArray(user.roles)) ? (
                    <select
                      value={user.team ?? ""}
                      disabled={!!updating}
                      onChange={(e) => updateTeam(user.id, e.target.value ? (e.target.value as TeamName) : null)}
                      className="input-base w-auto min-w-[120px] py-2"
                    >
                      <option value="">-</option>
                      {TEAMS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-slate-500 dark:text-slate-300">-</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <button
                    type="button"
                    disabled={!!updating}
                    onClick={() => toggleStatus(user.id, !user.status)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50 ${
                      user.status
                        ? "bg-emerald-400/20 text-emerald-800 border-emerald-400/30 dark:bg-emerald-500/35 dark:text-emerald-100 dark:border-emerald-400/50"
                        : "bg-red-400/20 text-red-800 border-red-400/30 dark:bg-red-500/35 dark:text-red-100 dark:border-red-400/50"
                    }`}
                  >
                    {user.status ? "Enabled" : "Disabled"}
                  </button>
                </td>
                <td className="sticky right-0 px-5 py-4 text-right backdrop-blur">
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      href={`/admin/users/${user.id}/edit`}
                      className="rounded-xl border border-primary-200/70 bg-primary-50/80 px-3 py-1.5 text-sm font-medium text-primary-700 hover:bg-primary-100 dark:border-primary-500/30 dark:bg-primary-950/30 dark:text-sky-200 dark:hover:bg-primary-900/40 dark:hover:text-white"
                    >
                      Edit
                    </Link>
                    {currentUserId !== user.id && (
                      <button
                        type="button"
                        disabled={!!deleting}
                        onClick={() => deleteUser(user.id)}
                        className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-300 dark:hover:text-red-200"
                      >
                        {deleting === user.id ? "..." : "Deactivate"}
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
  </div>
  );
}

