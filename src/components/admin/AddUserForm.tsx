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
  const [mode, setMode] = useState<"single" | "multiple">("single");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [emailsText, setEmailsText] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(["REQUESTER"]);
  const [team, setTeam] = useState<TeamName | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const needsTeam = selectedRoles.includes("FUNCTIONAL_HEAD") || selectedRoles.includes("L1_APPROVER");

  function toggleRole(r: UserRole) {
    setSelectedRoles((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (selectedRoles.length === 0) {
      setError("Select at least one role.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "multiple") {
        const lines = emailsText
          .split(/\n/)
          .map((s) => s.trim().toLowerCase())
          .filter((s) => s.length > 0 && s.includes("@"));
        const unique = Array.from(new Set(lines));
        if (unique.length === 0) {
          setError("Enter at least one valid email (one per line).");
          setLoading(false);
          return;
        }
        if (unique.length > 200) {
          setError("Maximum 200 emails at once.");
          setLoading(false);
          return;
        }
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emails: unique,
            roles: selectedRoles,
            team: needsTeam && team ? team : null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError((data as { error?: string }).error ?? "Failed to add users");
          return;
        }
        router.push("/admin");
        router.refresh();
        return;
      }

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim() || undefined,
          roles: selectedRoles,
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
        <div className="flex gap-4 border-b border-white/20 pb-4 dark:border-white/10">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="mode"
              checked={mode === "single"}
              onChange={() => setMode("single")}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Single user</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="mode"
              checked={mode === "multiple"}
              onChange={() => setMode("multiple")}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Multiple users</span>
          </label>
        </div>

        {mode === "single" ? (
          <>
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
          </>
        ) : (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Emails (one per line) *</label>
            <textarea
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
              className="input-base min-h-[140px] resize-y font-mono text-sm"
              placeholder={"user1@company.com\nuser2@company.com\nuser3@company.com"}
              rows={6}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
              One email per line. Same role and team will apply to all. Duplicates are ignored. Max 200 at once.
            </p>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Roles * (select one or more)</label>
          <div className="flex flex-wrap gap-4 rounded-xl border border-white/25 bg-white/20 p-4 dark:border-white/10 dark:bg-white/5">
            {roles.map((r) => (
              <label key={r} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedRoles.includes(r)}
                  onChange={() => toggleRole(r)}
                  className="h-4 w-4 rounded border-white/50 text-primary-600 focus:ring-primary-500/30"
                />
                <span className="text-sm text-slate-700 dark:text-slate-200">{roleLabels[r]}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
            At least one role required. Team is used for Department Head and L1 Approver.
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
          {loading ? "Adding…" : mode === "multiple" ? "Add users" : "Add user"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
