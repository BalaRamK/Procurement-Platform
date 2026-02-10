"use client";

import { useState, useEffect, useCallback } from "react";
import type { TeamName } from "@/types/db";
import { TEAM_NAMES } from "@/types/db";

const TEAM_LABELS: Record<TeamName, string> = {
  INNOVATION: "Innovation",
  ENGINEERING: "Engineering",
  SALES: "Sales",
};

type Project = { id: string; name: string; sortOrder: number };
type ChargeCode = { id: string; code: string; teamName: TeamName; sortOrder: number };

export function RequestOptionsManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [chargeCodes, setChargeCodes] = useState<ChargeCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [newChargeCode, setNewChargeCode] = useState("");
  const [newChargeTeam, setNewChargeTeam] = useState<TeamName>("ENGINEERING");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/request-options");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Failed to load");
        return;
      }
      const data = await res.json();
      setProjects(data.projects ?? []);
      setChargeCodes(data.chargeCodes ?? []);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newProjectName.trim();
    if (!name || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/request-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "project", name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Failed to add");
        return;
      }
      setNewProjectName("");
      await load();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const addChargeCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = newChargeCode.trim();
    if (!code || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/request-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "charge_code", code, teamName: newChargeTeam }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Failed to add");
        return;
      }
      setNewChargeCode("");
      await load();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteProject = async (id: string) => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/request-options/project-names/" + id, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Failed to delete");
        return;
      }
      await load();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteChargeCode = async (id: string) => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/request-options/charge-codes/" + id, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Failed to delete");
        return;
      }
      await load();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-slate-500 dark:text-slate-400">Loading...</p>;
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      <section className="card overflow-hidden">
        <div className="card-header border-b border-white/20 px-6 py-4 dark:border-white/10">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Project / Customer names</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            These appear in the Project/Customer Name dropdown on the New request form.
          </p>
        </div>
        <div className="p-6">
          <form onSubmit={addProject} className="mb-4 flex flex-wrap items-end gap-3">
            <label className="flex-1 min-w-[200px]">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Add name</span>
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="input-base w-full"
                placeholder="e.g. QShield QConnect"
              />
            </label>
            <button type="submit" disabled={submitting || !newProjectName.trim()} className="btn-primary">
              Add
            </button>
          </form>
          <ul className="flex flex-wrap gap-2">
            {projects.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/20 px-3 py-1.5 text-sm dark:border-white/10 dark:bg-white/5"
              >
                <span className="text-slate-800 dark:text-slate-200">{p.name}</span>
                <button
                  type="button"
                  onClick={() => deleteProject(p.id)}
                  disabled={submitting}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  aria-label={"Delete " + p.name}
                >
                  x
                </button>
              </li>
            ))}
            {projects.length === 0 && (
              <li className="text-sm text-slate-500 dark:text-slate-400">No project names yet. Add one above or run the seed script.</li>
            )}
          </ul>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="card-header border-b border-white/20 px-6 py-4 dark:border-white/10">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Charge codes</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Shown in the New request form by team (Innovation, Engineering, Sales).
          </p>
        </div>
        <div className="p-6">
          <form onSubmit={addChargeCode} className="mb-4 flex flex-wrap items-end gap-3">
            <label className="min-w-[180px]">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Code</span>
              <input
                type="text"
                value={newChargeCode}
                onChange={(e) => setNewChargeCode(e.target.value)}
                className="input-base w-full"
                placeholder="e.g. QN_EN_CAPX_PD"
              />
            </label>
            <label className="min-w-[140px]">
              <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Team</span>
              <select
                value={newChargeTeam}
                onChange={(e) => setNewChargeTeam(e.target.value as TeamName)}
                className="input-base w-full"
              >
                {TEAM_NAMES.map((t) => (
                  <option key={t} value={t}>
                    {TEAM_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={submitting || !newChargeCode.trim()} className="btn-primary">
              Add
            </button>
          </form>
          <div className="space-y-3">
            {TEAM_NAMES.map((team) => {
              const codes = chargeCodes.filter((c) => c.teamName === team);
              return (
                <div key={team}>
                  <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300">{TEAM_LABELS[team]}</h3>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {codes.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center gap-2 rounded-xl border border-white/30 bg-white/20 px-3 py-1.5 text-sm dark:border-white/10 dark:bg-white/5"
                      >
                        <span className="text-slate-800 dark:text-slate-200">{c.code}</span>
                        <button
                          type="button"
                          onClick={() => deleteChargeCode(c.id)}
                          disabled={submitting}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          aria-label={"Delete " + c.code}
                        >
                          x
                        </button>
                      </li>
                    ))}
                    {codes.length === 0 && (
                      <li className="text-sm text-slate-500 dark:text-slate-400">None</li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
