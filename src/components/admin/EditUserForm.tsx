"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole, TeamName } from "@/types/db";

const TEAMS: { value: TeamName; label: string }[] = [
  { value: "INNOVATION", label: "Innovation" },
  { value: "ENGINEERING", label: "Engineering" },
  { value: "SALES", label: "Sales" },
];

type UserForEdit = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  team: TeamName | null;
  status: boolean;
};

type EditUserFormProps = {
  user: UserForEdit;
  roleLabels: Record<UserRole, string>;
  roles: UserRole[];
};

export function EditUserForm({ user, roleLabels, roles }: EditUserFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(user.email);
  const [name, setName] = useState(user.name ?? "");
  const [role, setRole] = useState<UserRole>(user.role);
  const [team, setTeam] = useState<TeamName | "">(user.team ?? "");
  const [status, setStatus] = useState(user.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const needsTeam = role === "FUNCTIONAL_HEAD" || role === "L1_APPROVER";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          email: email.trim().toLowerCase(),
          name: name.trim() || null,
          role,
          team: needsTeam && team ? team : null,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Failed to update");
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
    <form onSubmit={handleSubmit} className="card max-w-xl divide-y divide-white/20">
      <div className="space-y-6 px-6 py-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Email (corporate) *</label>
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
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-base"
            placeholder="Display name"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Role *</label>
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="input-base" required>
            {roles.map((r) => (
              <option key={r} value={r}>{roleLabels[r]}</option>
            ))}
          </select>
        </div>
        {needsTeam && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Team</label>
            <select value={team} onChange={(e) => setTeam(e.target.value as TeamName | "")} className="input-base">
              <option value="">— Select team —</option>
              {TEAMS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={status}
              onChange={(e) => setStatus(e.target.checked)}
              className="h-4 w-4 rounded border-white/50 bg-white/60 text-primary-600 focus:ring-primary-500/30"
            />
            <span className="text-sm text-slate-700">Enabled (user can sign in)</span>
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <div className="flex flex-wrap gap-3 border-t border-white/30 bg-white/40 px-6 py-4 backdrop-blur-sm">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={() => router.push("/admin")} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
