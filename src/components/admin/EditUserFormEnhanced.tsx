"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { TeamName, UserRole } from "@/types/db";
import { asRolesArray } from "@/types/db";

const TEAMS: { value: TeamName; label: string }[] = [
  { value: "INNOVATION", label: "Innovation" },
  { value: "ENGINEERING", label: "Engineering" },
  { value: "SALES", label: "Sales" },
];

const ROLE_HELP: Partial<Record<UserRole, string>> = {
  REQUESTER: "Can create and track purchase requests.",
  FUNCTIONAL_HEAD: "Reviews requests for the assigned team.",
  L1_APPROVER: "Handles the second approval stage for a team.",
  CFO: "Approves finance-stage requests across teams.",
  CDO: "Owns the final approval before procurement begins.",
  PRODUCTION: "Fulfills approved requests and marks delivery.",
  SUPER_ADMIN: "Manages users, settings, and templates.",
};

type UserForEdit = {
  id: string;
  email: string;
  name: string | null;
  roles: UserRole[];
  team: TeamName | null;
  status: boolean;
};

type EditUserFormProps = {
  user: UserForEdit;
  roleLabels: Record<UserRole, string>;
  roles: UserRole[];
};

function roleTone(role: UserRole) {
  switch (role) {
    case "SUPER_ADMIN":
      return "border-slate-300/60 bg-slate-100/80 text-slate-800 dark:border-slate-500/30 dark:bg-slate-800/60 dark:text-slate-100";
    case "REQUESTER":
      return "border-sky-300/60 bg-sky-50/80 text-sky-800 dark:border-sky-500/30 dark:bg-sky-950/30 dark:text-sky-200";
    case "FUNCTIONAL_HEAD":
      return "border-indigo-300/60 bg-indigo-50/80 text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-950/30 dark:text-indigo-200";
    case "L1_APPROVER":
      return "border-amber-300/60 bg-amber-50/80 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200";
    case "CFO":
      return "border-emerald-300/60 bg-emerald-50/80 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200";
    case "CDO":
      return "border-rose-300/60 bg-rose-50/80 text-rose-900 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200";
    case "PRODUCTION":
      return "border-teal-300/60 bg-teal-50/80 text-teal-900 dark:border-teal-500/30 dark:bg-teal-950/30 dark:text-teal-200";
  }
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/30 bg-white/55 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function EditUserFormEnhanced({ user, roleLabels, roles }: EditUserFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(user.email);
  const [name, setName] = useState(user.name ?? "");
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(asRolesArray(user.roles));
  const [team, setTeam] = useState<TeamName | "">(user.team ?? "");
  const [status, setStatus] = useState(user.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const needsTeam = selectedRoles.includes("FUNCTIONAL_HEAD") || selectedRoles.includes("L1_APPROVER");

  function toggleRole(role: UserRole) {
    setSelectedRoles((prev) => (prev.includes(role) ? prev.filter((item) => item !== role) : [...prev, role]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (selectedRoles.length === 0) {
      setError("Select at least one role.");
      return;
    }
    if (needsTeam && !team) {
      setError("Team is required for Department Head and L1 Approver roles.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          email: email.trim().toLowerCase(),
          name: name.trim() || null,
          roles: selectedRoles,
          team: needsTeam && team ? team : null,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Failed to update user");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Failed to update user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid max-w-5xl gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <SectionCard title="Identity" description="Update the person's sign-in email and display information for the platform.">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Corporate email *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-base" placeholder="user@company.com" required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Display name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-base" placeholder="Shown in comments and approvals" />
            </div>
            <div className="rounded-2xl border border-white/30 bg-white/35 px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Profile status</p>
              <label className="mt-2 flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={status}
                  onChange={(e) => setStatus(e.target.checked)}
                  className="h-4 w-4 rounded border-white/50 bg-white/60 text-primary-600 focus:ring-primary-500/30"
                />
                Enabled for sign in and workflow actions
              </label>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Roles and routing" description="Adjust what this profile can do and whether approvals should be scoped to a team.">
          <div className="grid gap-3 md:grid-cols-2">
            {roles.map((role) => {
              const selected = selectedRoles.includes(role);
              return (
                <label
                  key={role}
                  className={`rounded-2xl border p-4 transition ${
                    selected
                      ? `${roleTone(role)} shadow-sm`
                      : "border-white/30 bg-white/35 hover:border-primary-200 dark:border-white/10 dark:bg-white/5"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleRole(role)}
                      className="mt-1 h-4 w-4 rounded border-white/50 text-primary-600 focus:ring-primary-500/30"
                    />
                    <div>
                      <p className="text-sm font-semibold">{roleLabels[role]}</p>
                      <p className="mt-1 text-sm opacity-80">{ROLE_HELP[role]}</p>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {needsTeam ? (
            <div className="mt-4 rounded-2xl border border-amber-300/50 bg-amber-50/80 p-4 dark:border-amber-500/20 dark:bg-amber-950/20">
              <label className="mb-1.5 block text-sm font-medium text-amber-900 dark:text-amber-100">Team assignment *</label>
              <select value={team} onChange={(e) => setTeam(e.target.value as TeamName | "")} className="input-base">
                <option value="">Select team</option>
                {TEAMS.map((teamOption) => (
                  <option key={teamOption.value} value={teamOption.value}>
                    {teamOption.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">Department Head and L1 Approver roles only see requests from their assigned team.</p>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/30 bg-white/35 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              No team assignment is needed for the current role selection.
            </div>
          )}
        </SectionCard>

        {error ? <p className="text-sm font-medium text-red-600 dark:text-red-300">{error}</p> : null}

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "Saving..." : "Save changes"}
          </button>
          <button type="button" onClick={() => router.push("/admin")} className="btn-secondary">
            Cancel
          </button>
        </div>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <SectionCard title="Current access summary" description="Quick view of how this profile is configured.">
          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/30 bg-white/35 px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Sign in status</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{status ? "Enabled" : "Disabled"}</p>
            </div>
            <div className="rounded-2xl border border-white/30 bg-white/35 px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Selected roles</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedRoles.map((role) => (
                  <span key={role} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${roleTone(role)}`}>
                    {roleLabels[role]}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/30 bg-white/35 px-4 py-3 dark:border-white/10 dark:bg-white/5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Routing</p>
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                {needsTeam && team ? `Team-scoped access for ${TEAMS.find((item) => item.value === team)?.label}` : needsTeam ? "Team assignment still needed" : "No team routing required"}
              </p>
            </div>
          </div>
        </SectionCard>
      </aside>
    </form>
  );
}
