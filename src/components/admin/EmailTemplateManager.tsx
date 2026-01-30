"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const TRIGGERS = [
  { value: "request_created", label: "Request created" },
  { value: "request_submitted", label: "Request submitted" },
  { value: "request_rejected", label: "Request rejected" },
  { value: "pending_fh_reminder", label: "Pending FH approval reminder" },
  { value: "pending_l1_reminder", label: "Pending L1 approval reminder" },
  { value: "assigned_to_production", label: "Assigned to production" },
  { value: "delivered_to_requester", label: "Delivered to requester" },
  { value: "request_closed", label: "Request closed" },
] as const;

const TIMELINES = [
  { value: "immediate", label: "Immediate" },
  { value: "after_24h", label: "24 hours after" },
  { value: "after_48h", label: "48 hours after" },
  { value: "custom", label: "Custom (delay minutes)" },
] as const;

type EmailTemplate = {
  id: string;
  name: string;
  trigger: string;
  subjectTemplate: string;
  bodyTemplate: string;
  timeline: string;
  delayMinutes: number | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export function EmailTemplateManager() {
  const router = useRouter();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState<"add" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    trigger: "request_created",
    subjectTemplate: "",
    bodyTemplate: "",
    timeline: "immediate" as "immediate" | "after_24h" | "after_48h" | "custom",
    delayMinutes: "" as string | number,
    enabled: true,
  });

  function loadTemplates() {
    fetch("/api/admin/email-templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(Array.isArray(data) ? data : []);
      })
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  function openAdd() {
    setForm({
      name: "",
      trigger: "request_created",
      subjectTemplate: "",
      bodyTemplate: "",
      timeline: "immediate",
      delayMinutes: "",
      enabled: true,
    });
    setEditingId(null);
    setFormOpen("add");
    setError("");
  }

  function openEdit(t: EmailTemplate) {
    setForm({
      name: t.name,
      trigger: t.trigger,
      subjectTemplate: t.subjectTemplate,
      bodyTemplate: t.bodyTemplate,
      timeline: t.timeline as "immediate" | "after_24h" | "after_48h" | "custom",
      delayMinutes: t.delayMinutes ?? "",
      enabled: t.enabled,
    });
    setEditingId(t.id);
    setFormOpen("add");
    setError("");
  }

  function closeForm() {
    setFormOpen(null);
    setEditingId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        trigger: form.trigger,
        subjectTemplate: form.subjectTemplate.trim(),
        bodyTemplate: form.bodyTemplate.trim(),
        timeline: form.timeline,
        delayMinutes: form.timeline === "custom" && form.delayMinutes !== "" ? Number(form.delayMinutes) : null,
        enabled: form.enabled,
      };
      const url = editingId ? `/api/admin/email-templates/${editingId}` : "/api/admin/email-templates";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Failed to save");
        return;
      }
      closeForm();
      loadTemplates();
      router.refresh();
    } catch {
      setError("Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this email template?")) return;
    try {
      const res = await fetch(`/api/admin/email-templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      loadTemplates();
      router.refresh();
    } catch {
      alert("Failed to delete template");
    }
  }

  const placeholderHelp = "Placeholders: {{requesterName}}, {{ticketId}}, {{ticketTitle}}, {{status}}, {{rejectionRemarks}}";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            Configure auto emails and when they are sent. Use placeholders in subject and body.
          </p>
        </div>
        <button type="button" onClick={openAdd} className="btn-primary">
          Add template
        </button>
      </div>

      {formOpen && (
        <div className="card mb-8 overflow-hidden">
          <div className="card-header border-b px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {editingId ? "Edit template" : "Add template"}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="divide-y divide-white/20">
            <div className="space-y-4 px-6 py-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="input-base"
                    placeholder="e.g. Request created"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Trigger *</label>
                  <select
                    value={form.trigger}
                    onChange={(e) => setForm((f) => ({ ...f, trigger: e.target.value }))}
                    className="input-base"
                  >
                    {TRIGGERS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Timeline *</label>
                <select
                  value={form.timeline}
                  onChange={(e) => setForm((f) => ({ ...f, timeline: e.target.value as typeof form.timeline }))}
                  className="input-base max-w-xs"
                >
                  {TIMELINES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {form.timeline === "custom" && (
                  <div className="mt-2">
                    <input
                      type="number"
                      min={0}
                      value={form.delayMinutes}
                      onChange={(e) => setForm((f) => ({ ...f, delayMinutes: e.target.value }))}
                      className="input-base w-32"
                      placeholder="Minutes"
                    />
                    <span className="ml-2 text-sm text-slate-500">minutes after trigger</span>
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Subject *</label>
                <input
                  type="text"
                  value={form.subjectTemplate}
                  onChange={(e) => setForm((f) => ({ ...f, subjectTemplate: e.target.value }))}
                  className="input-base"
                  placeholder="e.g. Procurement request {{ticketId}} created"
                  required
                />
                <p className="mt-1 text-xs text-slate-500">{placeholderHelp}</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Body *</label>
                <textarea
                  value={form.bodyTemplate}
                  onChange={(e) => setForm((f) => ({ ...f, bodyTemplate: e.target.value }))}
                  className="input-base min-h-[120px]"
                  placeholder="Hi {{requesterName}}, your request {{ticketTitle}} has been created..."
                  required
                />
                <p className="mt-1 text-xs text-slate-500">{placeholderHelp}</p>
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                    className="h-4 w-4 rounded border-white/50 bg-white/60 text-primary-600 focus:ring-primary-500/30"
                  />
                  <span className="text-sm text-slate-700">Enabled (send this email when trigger fires)</span>
                </label>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
            <div className="card-header flex flex-wrap gap-3 border-t border-white/25 px-6 py-4">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Saving…" : editingId ? "Save changes" : "Add template"}
              </button>
              <button type="button" onClick={closeForm} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="card-header border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Email templates</h2>
          <p className="mt-1 text-sm text-slate-500">Templates are used when sending automated emails at each stage.</p>
        </div>
        {loading ? (
          <div className="px-6 py-8 text-center text-slate-500">Loading…</div>
        ) : templates.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-500">
            No templates yet. Click &quot;Add template&quot; to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/20">
              <thead>
                <tr>
                  <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                  <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Trigger</th>
                  <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Timeline</th>
                  <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Subject</th>
                  <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Enabled</th>
                  <th className="card-header px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/20 bg-white/25">
                {templates.map((t) => (
                  <tr key={t.id} className="table-row-glass transition-colors">
                    <td className="px-5 py-4 font-medium text-slate-900">{t.name}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{t.trigger}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {t.timeline}
                      {t.timeline === "custom" && t.delayMinutes != null ? ` (${t.delayMinutes} min)` : ""}
                    </td>
                    <td className="max-w-[200px] truncate px-5 py-4 text-sm text-slate-600" title={t.subjectTemplate}>
                      {t.subjectTemplate}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`glass-panel inline-flex px-2.5 py-1 text-xs font-medium ${
                          t.enabled ? "bg-emerald-400/20 text-emerald-800 border-emerald-400/30" : "bg-slate-400/15 text-slate-600 border-slate-300/30"
                        }`}
                      >
                        {t.enabled ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="mr-3 text-sm font-medium text-primary-600 hover:text-primary-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(t.id)}
                        className="text-sm font-medium text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
