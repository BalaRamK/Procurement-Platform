"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type EmailLog = {
  id: string;
  ticketId: string;
  ticketTitle: string | null;
  type: string;
  recipient: string;
  sentAt: string;
  payload: string | null;
};

type EmailStats = {
  total: string;
  last24h: string;
  last7d: string;
};

/** Placeholders available in subject and body (must match EmailContext in lib/email.ts) */
const TEMPLATE_FIELDS = [
  { key: "requesterName", label: "Requester name" },
  { key: "ticketId", label: "Ticket ID" },
  { key: "ticketTitle", label: "Ticket title" },
  { key: "status", label: "Status" },
  { key: "rejectionRemarks", label: "Rejection remarks" },
] as const;

const TRIGGERS = [
  { value: "request_created", label: "Request created" },
  { value: "request_submitted", label: "Request submitted" },
  { value: "request_rejected", label: "Request rejected" },
  { value: "pending_fh_reminder", label: "Pending FH approval reminder" },
  { value: "pending_l1_reminder", label: "Pending L1 approval reminder" },
  { value: "assigned_to_production", label: "Assigned to production" },
  { value: "delivered_to_requester", label: "Delivered to requester" },
  { value: "request_closed", label: "Request closed" },
  { value: "comment_mention", label: "Comment @mention" },
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
  extraRecipients: string | null;
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

  // SMTP settings state
  const [smtpForm, setSmtpForm] = useState({ smtp_host: "", smtp_port: "", smtp_from: "", smtp_user: "", smtp_pass: "", smtp_proxy: "" });
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpResult, setSmtpResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Email logs state
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [logsLoading, setLogsLoading] = useState(true);

  // Test email state
  const [testEmail, setTestEmail] = useState("");
  const [testSubject, setTestSubject] = useState("Test email from Procurement Platform");
  const [testBody, setTestBody] = useState("This is a test email to verify your email configuration is working correctly.");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [form, setForm] = useState({
    name: "",
    trigger: "request_created",
    subjectTemplate: "",
    bodyTemplate: "",
    timeline: "immediate" as "immediate" | "after_24h" | "after_48h" | "custom",
    delayMinutes: "" as string | number,
    extraRecipients: [] as string[],
    enabled: true,
  });
  const [recipientInput, setRecipientInput] = useState("");
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);

  const insertPlaceholder = useCallback(
    (fieldKey: string, target: "subject" | "body") => {
      const placeholder = `{{${fieldKey}}}`;
      const ref = target === "subject" ? subjectInputRef.current : bodyInputRef.current;
      if (ref) {
        const el = ref as HTMLInputElement | HTMLTextAreaElement;
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? start;
        const value = target === "subject" ? form.subjectTemplate : form.bodyTemplate;
        const next = value.slice(0, start) + placeholder + value.slice(end);
        if (target === "subject") setForm((f) => ({ ...f, subjectTemplate: next }));
        else setForm((f) => ({ ...f, bodyTemplate: next }));
        setTimeout(() => {
          el.focus();
          const pos = start + placeholder.length;
          el.setSelectionRange(pos, pos);
        }, 0);
      } else {
        if (target === "subject") setForm((f) => ({ ...f, subjectTemplate: f.subjectTemplate + placeholder }));
        else setForm((f) => ({ ...f, bodyTemplate: f.bodyTemplate + placeholder }));
      }
    },
    [form.subjectTemplate, form.bodyTemplate]
  );

  function loadTemplates() {
    fetch("/api/admin/email-templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(Array.isArray(data) ? data : []);
      })
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }

  function loadLogs() {
    setLogsLoading(true);
    fetch("/api/admin/email-logs")
      .then((r) => r.json())
      .then((data) => {
        setLogs(Array.isArray(data.logs) ? data.logs : []);
        setStats(data.stats ?? null);
      })
      .catch(() => {
        setLogs([]);
        setStats(null);
      })
      .finally(() => setLogsLoading(false));
  }

  function loadSmtpSettings() {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        setSmtpForm({
          smtp_host: data["smtp_host"] ?? "",
          smtp_port: data["smtp_port"] ?? "",
          smtp_from: data["smtp_from"] ?? "",
          smtp_user: data["smtp_user"] ?? "",
          smtp_pass: data["smtp_pass"] ?? "",
          smtp_proxy: data["smtp_proxy"] ?? "",
        });
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadTemplates();
    loadLogs();
    loadSmtpSettings();
  }, []);

  async function handleSmtpSave(e: React.FormEvent) {
    e.preventDefault();
    setSmtpSaving(true);
    setSmtpResult(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(smtpForm),
      });
      const data = await res.json() as { error?: string };
      setSmtpResult({ ok: res.ok, message: res.ok ? "Settings saved." : (data.error ?? "Failed to save") });
    } catch {
      setSmtpResult({ ok: false, message: "Failed to save settings" });
    } finally {
      setSmtpSaving(false);
    }
  }

  async function handleSendTestEmail(e: React.FormEvent) {
    e.preventDefault();
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/email-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail, subject: testSubject, body: testBody }),
      });
      const data = await res.json() as { message?: string; error?: string };
      setTestResult({ ok: res.ok, message: res.ok ? (data.message ?? "Test email sent!") : (data.error ?? "Failed to send") });
    } catch {
      setTestResult({ ok: false, message: "Failed to send test email" });
    } finally {
      setTestSending(false);
    }
  }

  function openAdd() {
    setForm({
      name: "",
      trigger: "request_created",
      subjectTemplate: "",
      bodyTemplate: "",
      timeline: "immediate",
      delayMinutes: "",
      extraRecipients: [],
      enabled: true,
    });
    setRecipientInput("");
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
      extraRecipients: t.extraRecipients
        ? t.extraRecipients.split(",").map((e) => e.trim()).filter(Boolean)
        : [],
      enabled: t.enabled,
    });
    setRecipientInput("");
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
        extraRecipients: form.extraRecipients.length > 0 ? form.extraRecipients.join(",") : null,
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

  return (
    <div>
      {/* SMTP Settings */}
      <div className="card mb-8 overflow-hidden">
        <div className="card-header border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">SMTP settings</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-200">
            Configure the outgoing mail server. Settings here override environment variables.
          </p>
        </div>
        <form onSubmit={handleSmtpSave} className="space-y-4 px-6 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">SMTP host</label>
              <input
                type="text"
                value={smtpForm.smtp_host}
                onChange={(e) => setSmtpForm((f) => ({ ...f, smtp_host: e.target.value }))}
                className="input-base"
                placeholder="e.g. smtp.sendgrid.net"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">SMTP port</label>
              <input
                type="text"
                value={smtpForm.smtp_port}
                onChange={(e) => setSmtpForm((f) => ({ ...f, smtp_port: e.target.value }))}
                className="input-base"
                placeholder="587 or 465"
              />
              <p className="mt-1 text-xs text-slate-400">587 = STARTTLS &nbsp;|&nbsp; 465 = SSL</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">From address</label>
              <input
                type="email"
                value={smtpForm.smtp_from}
                onChange={(e) => setSmtpForm((f) => ({ ...f, smtp_from: e.target.value }))}
                className="input-base"
                placeholder="noreply@yourcompany.com"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">SMTP username</label>
              <input
                type="text"
                value={smtpForm.smtp_user}
                onChange={(e) => setSmtpForm((f) => ({ ...f, smtp_user: e.target.value }))}
                className="input-base"
                placeholder="apikey or email"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">SMTP password / API key</label>
              <input
                type="password"
                value={smtpForm.smtp_pass}
                onChange={(e) => setSmtpForm((f) => ({ ...f, smtp_pass: e.target.value }))}
                className="input-base"
                placeholder={smtpForm.smtp_pass === "••••••••" ? "Leave unchanged or enter a new password" : "Enter password or API key"}
                autoComplete="new-password"
              />
              {smtpForm.smtp_pass === "••••••••" && (
                <p className="mt-1 text-xs text-slate-400">Password is set. Enter a new value to change it.</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Proxy URL <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={smtpForm.smtp_proxy}
                onChange={(e) => setSmtpForm((f) => ({ ...f, smtp_proxy: e.target.value }))}
                className="input-base"
                placeholder="http://proxy-host:8080 or socks5://proxy-host:1080"
              />
              <p className="mt-1 text-xs text-slate-400">
                Required if the server cannot reach the SMTP host directly. Supports HTTP CONNECT and SOCKS4/SOCKS5 proxies.
                Leave blank to connect directly.
              </p>
            </div>
          </div>
          {smtpResult && (
            <p className={`text-sm font-medium ${smtpResult.ok ? "text-emerald-600" : "text-red-600"}`}>
              {smtpResult.message}
            </p>
          )}
          <button type="submit" disabled={smtpSaving} className="btn-primary">
            {smtpSaving ? "Saving…" : "Save SMTP settings"}
          </button>
        </form>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-200">
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
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {editingId ? "Edit template" : "Add template"}
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="divide-y divide-white/20">
            <div className="space-y-4 px-6 py-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Name *</label>
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
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Trigger *</label>
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
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Timeline *</label>
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
                    <span className="ml-2 text-sm text-slate-500 dark:text-slate-300">minutes after trigger</span>
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Subject *</label>
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Insert field:</p>
                <div className="mb-2 flex flex-wrap gap-2">
                  {TEMPLATE_FIELDS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => insertPlaceholder(key, "subject")}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-primary-500 dark:hover:bg-primary-900/30"
                    >
                      {label} <code className="ml-0.5 text-[10px] opacity-80">{`{{${key}}}`}</code>
                    </button>
                  ))}
                </div>
                <input
                  ref={subjectInputRef}
                  type="text"
                  value={form.subjectTemplate}
                  onChange={(e) => setForm((f) => ({ ...f, subjectTemplate: e.target.value }))}
                  className="input-base"
                  placeholder="e.g. Procurement request {{ticketId}} created"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Body *</label>
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Insert field:</p>
                <div className="mb-2 flex flex-wrap gap-2">
                  {TEMPLATE_FIELDS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => insertPlaceholder(key, "body")}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-primary-500 dark:hover:bg-primary-900/30"
                    >
                      {label} <code className="ml-0.5 text-[10px] opacity-80">{`{{${key}}}`}</code>
                    </button>
                  ))}
                </div>
                <textarea
                  ref={bodyInputRef}
                  value={form.bodyTemplate}
                  onChange={(e) => setForm((f) => ({ ...f, bodyTemplate: e.target.value }))}
                  className="input-base min-h-[120px]"
                  placeholder="Hi {{requesterName}}, your request {{ticketTitle}} has been created..."
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Recipients <span className="font-normal text-slate-400">(additional — always CC&apos;d on this trigger)</span>
                </label>
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                  The dynamic recipient (requester, assignee, etc.) is always included. Add extra email addresses here.
                </p>
                {form.extraRecipients.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {form.extraRecipients.map((email) => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1 rounded-full border border-primary-300/40 bg-primary-100/30 px-2.5 py-1 text-xs font-medium text-primary-800 dark:border-primary-500/30 dark:bg-primary-900/20 dark:text-primary-300"
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, extraRecipients: f.extraRecipients.filter((e) => e !== email) }))}
                          className="ml-0.5 rounded-full text-primary-500 hover:text-primary-700 dark:text-primary-400"
                          aria-label={`Remove ${email}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={recipientInput}
                    onChange={(e) => setRecipientInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        const val = recipientInput.trim().replace(/,$/, "");
                        if (val.includes("@") && !form.extraRecipients.includes(val)) {
                          setForm((f) => ({ ...f, extraRecipients: [...f.extraRecipients, val] }));
                        }
                        setRecipientInput("");
                      }
                    }}
                    className="input-base flex-1"
                    placeholder="email@example.com — press Enter or comma to add"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = recipientInput.trim();
                      if (val.includes("@") && !form.extraRecipients.includes(val)) {
                        setForm((f) => ({ ...f, extraRecipients: [...f.extraRecipients, val] }));
                      }
                      setRecipientInput("");
                    }}
                    className="btn-secondary shrink-0"
                  >
                    Add
                  </button>
                </div>
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
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Email templates</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-200">Templates are used when sending automated emails at each stage.</p>
        </div>
        {loading ? (
          <div className="px-6 py-8 text-center text-slate-500 dark:text-slate-300">Loading…</div>
        ) : templates.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-500 dark:text-slate-200">
            No templates yet. Click &quot;Add template&quot; to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/20">
              <thead>
                <tr>
                  <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Name</th>
                  <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Trigger</th>
                  <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Timeline</th>
                  <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Subject</th>
                  <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Extra recipients</th>
                  <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Enabled</th>
                  <th className="card-header px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Actions</th>
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
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {t.extraRecipients ? (
                        <div className="flex flex-wrap gap-1">
                          {t.extraRecipients.split(",").map((e) => e.trim()).filter(Boolean).map((email) => (
                            <span key={email} className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                              {email}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
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

      {/* Test Email */}
      <div className="card mt-8 overflow-hidden">
        <div className="card-header border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Send test email</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-200">
            Verify your SMTP configuration by sending a test email.
          </p>
        </div>
        <form onSubmit={handleSendTestEmail} className="space-y-4 px-6 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Send to *</label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="input-base"
                placeholder="recipient@example.com"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Subject</label>
              <input
                type="text"
                value={testSubject}
                onChange={(e) => setTestSubject(e.target.value)}
                className="input-base"
                placeholder="Test email subject"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Body</label>
            <textarea
              value={testBody}
              onChange={(e) => setTestBody(e.target.value)}
              className="input-base min-h-[80px]"
              placeholder="Test email body..."
            />
          </div>
          {testResult && (
            <p className={`text-sm font-medium ${testResult.ok ? "text-emerald-600" : "text-red-600"}`}>
              {testResult.message}
            </p>
          )}
          <button type="submit" disabled={testSending} className="btn-primary">
            {testSending ? "Sending…" : "Send test email"}
          </button>
        </form>
      </div>

      {/* Email Logs */}
      <div className="card mt-8 overflow-hidden">
        <div className="card-header border-b px-6 py-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Email activity</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-200">Recent emails triggered by the system (last 100).</p>
          </div>
          {stats && (
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.last24h}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Last 24h</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.last7d}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Last 7d</p>
              </div>
              <button
                type="button"
                onClick={loadLogs}
                className="self-start text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                Refresh
              </button>
            </div>
          )}
        </div>
        {logsLoading ? (
          <div className="px-6 py-8 text-center text-slate-500 dark:text-slate-300">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-500 dark:text-slate-200">No emails sent yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/20">
              <thead>
                <tr>
                  <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Sent to</th>
                  <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Type</th>
                  <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Ticket</th>
                  <th className="card-header px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Date &amp; Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/20 bg-white/25">
                {logs.map((log) => (
                  <tr key={log.id} className="table-row-glass transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-slate-900 dark:text-white">{log.recipient}</td>
                    <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-300">
                      <span className="inline-flex rounded-full border border-primary-300/30 bg-primary-100/20 px-2.5 py-0.5 text-xs font-medium text-primary-800 dark:text-primary-300">
                        {log.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-5 py-3 text-sm text-slate-600 dark:text-slate-300" title={log.ticketTitle ?? log.ticketId}>
                      {log.ticketTitle ?? <span className="font-mono text-xs">{log.ticketId.slice(0, 8)}…</span>}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {new Date(log.sentAt).toLocaleString()}
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
