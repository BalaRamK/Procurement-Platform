"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole, TeamName } from "@/types/db";

const TEAMS: { value: TeamName; label: string }[] = [
  { value: "INNOVATION", label: "Innovation" },
  { value: "ENGINEERING", label: "Engineering" },
  { value: "SALES", label: "Sales" },
];

type AddUserFormProps = {
  roles: UserRole[];
  roleLabels: Record<UserRole, string>;
};

export function AddUserForm({ roles, roleLabels }: AddUserFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("REQUESTER");
  const [team, setTeam] = useState<TeamName | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const needsTeam = role === "FUNCTIONAL_HEAD" || role === "L1_APPROVER";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim() || undefined,
          role,
          team: needsTeam && team ? team : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Failed to add user");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Failed to add user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card max-w-xl divide-y divide-white/20 dark:divide-white/10">
      <div className="space-y-6 px-6 py-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Email (corporate) *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-base"
            placeholder="user@company.com"
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-base"
            placeholder="Optional; can be set when they sign in"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Role *</label>
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="input-base" required>
            {roles.map((r) => (
              <option key={r} value={r}>{roleLabels[r]}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
            Requester, Department Head (first-level), L1 Approver (second-level), Finance Team, CDO, Procurement Team, Admin.
          </p>
        </div>
        {needsTeam && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Team</label>
            <select value={team} onChange={(e) => setTeam(e.target.value as TeamName | "")} className="input-base">
              <option value="">— Select team —</option>
              {TEAMS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Required for Department Head and L1 Approver so they see the right pending approvals.</p>
          </div>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-300">{error}</p>}
      </div>
      <div className="card-header flex flex-wrap gap-3 border-t border-white/25 px-6 py-4">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Adding…" : "Add user"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
