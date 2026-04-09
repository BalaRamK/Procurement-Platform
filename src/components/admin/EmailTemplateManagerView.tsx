"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { EMAIL_TEMPLATE_FIELDS, EMAIL_TEMPLATE_TRIGGER_OPTIONS, SUBJECT_PREFIX } from "@/lib/email-template-catalog";
import { EmptyStateCard, MetricCard, Pill, SectionCard, TabBar } from "./EmailAdminChrome";

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

type EmailTemplateForm = {
  name: string;
  trigger: string;
  subjectTemplate: string;
  bodyTemplate: string;
  timeline: "immediate" | "after_24h" | "after_48h" | "custom";
  delayMinutes: string | number;
  extraRecipients: string[];
  enabled: boolean;
};

type AdminTab = "templates" | "delivery" | "diagnostics";
type TemplateGroup = "workflow" | "reminders" | "collaboration";
type TemplateGroupFilter = "all" | TemplateGroup;
type TemplateStatusFilter = "all" | "enabled" | "disabled";

const FIELD_LABEL_BY_KEY: Map<string, string> = new Map(EMAIL_TEMPLATE_FIELDS.map((field) => [field.key, field.label]));
const TRIGGER_LABEL_BY_VALUE: Map<string, string> = new Map(EMAIL_TEMPLATE_TRIGGER_OPTIONS.map((trigger) => [trigger.value, trigger.label]));
const PLACEHOLDER_GROUPS: { title: string; keys: string[] }[] = [
  { title: "Requester", keys: ["requesterName", "requesterEmail"] },
  {
    title: "Request",
    keys: ["ticketId", "ticketTitle", "status", "department", "teamName", "priority", "needByDate", "estimatedCost"],
  },
  { title: "Workflow", keys: ["currentStage", "nextStage", "actionBy", "approverName", "requestUrl"] },
  { title: "Notes", keys: ["description", "rejectionRemarks"] },
];

function getTemplateGroup(trigger: string): TemplateGroup {
  if (trigger.startsWith("pending_") || trigger === "request_auto_closed") return "reminders";
  if (trigger === "comment_mention") return "collaboration";
  return "workflow";
}

function getTemplateGroupLabel(group: TemplateGroup) {
  switch (group) {
    case "workflow":
      return "Workflow";
    case "reminders":
      return "Reminders";
    case "collaboration":
      return "Collaboration";
  }
}

function compactText(value: string, limit: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}...` : normalized;
}

function splitRecipients(value: string | null) {
  return value ? value.split(",").map((email) => email.trim()).filter(Boolean) : [];
}

function formatTimeline(template: EmailTemplate) {
  if (template.timeline !== "custom") {
    const match = TIMELINES.find((item) => item.value === template.timeline);
    return match?.label ?? template.timeline;
  }
  if (template.delayMinutes != null) {
    return `Custom - ${template.delayMinutes} min`;
  }
  return "Custom";
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString();
}

export function EmailTemplateManagerView() {
  const router = useRouter();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState<"add" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState<AdminTab>("templates");
  const [templateQuery, setTemplateQuery] = useState("");
  const [templateGroupFilter, setTemplateGroupFilter] = useState<TemplateGroupFilter>("all");
  const [templateStatusFilter, setTemplateStatusFilter] = useState<TemplateStatusFilter>("all");

  const [smtpForm, setSmtpForm] = useState({ smtp_host: "", smtp_port: "", smtp_from: "", smtp_user: "", smtp_pass: "", smtp_proxy: "" });
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpResult, setSmtpResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [logsLoading, setLogsLoading] = useState(true);

  const [testEmail, setTestEmail] = useState("");
  const [testSubject, setTestSubject] = useState("Test email from Procurement Platform");
  const [testBody, setTestBody] = useState("This is a test email to verify your email configuration is working correctly.");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [form, setForm] = useState<EmailTemplateForm>({
    name: "",
    trigger: "request_created",
    subjectTemplate: "",
    bodyTemplate: "",
    timeline: "immediate",
    delayMinutes: "",
    extraRecipients: [],
    enabled: true,
  });
  const [recipientInput, setRecipientInput] = useState("");
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);

  const templateStats = useMemo(() => {
    const enabled = templates.filter((template) => template.enabled).length;
    const workflow = templates.filter((template) => getTemplateGroup(template.trigger) === "workflow").length;
    const reminders = templates.filter((template) => getTemplateGroup(template.trigger) === "reminders").length;
    const collaboration = templates.filter((template) => getTemplateGroup(template.trigger) === "collaboration").length;
    return { enabled, workflow, reminders, collaboration };
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const query = templateQuery.trim().toLowerCase();
    return templates.filter((template) => {
      const group = getTemplateGroup(template.trigger);
      const searchable = [template.name, template.trigger, TRIGGER_LABEL_BY_VALUE.get(template.trigger) ?? "", template.subjectTemplate, template.bodyTemplate, template.extraRecipients ?? ""]
        .join(" ")
        .toLowerCase();
      const matchesQuery = !query || searchable.includes(query);
      const matchesGroup = templateGroupFilter === "all" || group === templateGroupFilter;
      const matchesStatus = templateStatusFilter === "all" || (templateStatusFilter === "enabled" ? template.enabled : !template.enabled);
      return matchesQuery && matchesGroup && matchesStatus;
    });
  }, [templateGroupFilter, templateQuery, templateStatusFilter, templates]);

  const templateTabs = useMemo(
    () => [
      { id: "templates", label: "Templates", count: templates.length },
      { id: "delivery", label: "Delivery" },
      { id: "diagnostics", label: "Diagnostics", count: logs.length },
    ],
    [logs.length, templates.length]
  );

  const resetTemplateFilters = useCallback(() => {
    setTemplateQuery("");
    setTemplateGroupFilter("all");
    setTemplateStatusFilter("all");
  }, []);

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
        if (target === "subject") setForm((current) => ({ ...current, subjectTemplate: next }));
        else setForm((current) => ({ ...current, bodyTemplate: next }));
        setTimeout(() => {
          el.focus();
          const pos = start + placeholder.length;
          el.setSelectionRange(pos, pos);
        }, 0);
      } else {
        if (target === "subject") setForm((current) => ({ ...current, subjectTemplate: current.subjectTemplate + placeholder }));
        else setForm((current) => ({ ...current, bodyTemplate: current.bodyTemplate + placeholder }));
      }
    },
    [form.bodyTemplate, form.subjectTemplate]
  );

  function loadTemplates() {
    setLoading(true);
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

  async function handleSmtpSave(e: FormEvent) {
    e.preventDefault();
    setSmtpSaving(true);
    setSmtpResult(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(smtpForm),
      });
      const data = (await res.json()) as { error?: string };
      setSmtpResult({ ok: res.ok, message: res.ok ? "Settings saved." : data.error ?? "Failed to save" });
    } catch {
      setSmtpResult({ ok: false, message: "Failed to save settings" });
    } finally {
      setSmtpSaving(false);
    }
  }

  async function handleSendTestEmail(e: FormEvent) {
    e.preventDefault();
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/email-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail, subject: testSubject, body: testBody }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      setTestResult({ ok: res.ok, message: res.ok ? data.message ?? "Test email sent!" : data.error ?? "Failed to send" });
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
    setActiveTab("templates");
    setError("");
  }

  function openEdit(t: EmailTemplate) {
    setForm({
      name: t.name,
      trigger: t.trigger,
      subjectTemplate: t.subjectTemplate,
      bodyTemplate: t.bodyTemplate,
      timeline: t.timeline as EmailTemplateForm["timeline"],
      delayMinutes: t.delayMinutes ?? "",
      extraRecipients: t.extraRecipients ? t.extraRecipients.split(",").map((email) => email.trim()).filter(Boolean) : [],
      enabled: t.enabled,
    });
    setRecipientInput("");
    setEditingId(t.id);
    setFormOpen("add");
    setActiveTab("templates");
    setError("");
  }

  function closeForm() {
    setFormOpen(null);
    setEditingId(null);
    setError("");
  }

  function addRecipientFromInput() {
    const value = recipientInput.trim().replace(/,$/, "");
    if (!value || !value.includes("@")) return;
    if (!form.extraRecipients.includes(value)) {
      setForm((current) => ({ ...current, extraRecipients: [...current.extraRecipients, value] }));
    }
    setRecipientInput("");
  }

  async function handleSubmit(e: FormEvent) {
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
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-300">Email admin</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Templates, delivery, and diagnostics</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-200">
            Keep template content, SMTP settings, and email logs separate so the page is easier to scan and maintain.
          </p>
        </div>
      </div>

      <TabBar tabs={templateTabs} activeId={activeTab} onChange={(id) => setActiveTab(id as AdminTab)} />

      {activeTab === "templates" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Templates" value={templates.length} hint="Saved templates" />
            <MetricCard label="Enabled" value={templateStats.enabled} hint="Ready to send" tone="success" />
            <MetricCard label="Workflow" value={templateStats.workflow} hint="Stage movement emails" tone="info" />
            <MetricCard label="Reminders" value={templateStats.reminders} hint="Follow-up messages" tone="warning" />
          </div>

          {formOpen ? (
            <SectionCard
              title={editingId ? "Edit template" : "Add template"}
              description="Define the trigger, write the subject and body, then control any additional CC recipients."
              actions={
                <button type="button" onClick={closeForm} className="btn-secondary">
                  Close editor
                </button>
              }
            >
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-white/25 bg-white/55 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/20">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">Basics</h3>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Name the template and choose the trigger it belongs to.</p>
                        </div>
                        <Pill tone="info">{editingId ? "Editing" : "New"}</Pill>
                      </div>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Name *</label>
                          <input
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                            className="input-base"
                            placeholder="e.g. Request created"
                            required
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Trigger *</label>
                          <select
                            value={form.trigger}
                            onChange={(e) => setForm((current) => ({ ...current, trigger: e.target.value }))}
                            className="input-base"
                          >
                            {EMAIL_TEMPLATE_TRIGGER_OPTIONS.map((trigger) => (
                              <option key={trigger.value} value={trigger.value}>
                                {trigger.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Timeline *</label>
                          <select
                            value={form.timeline}
                            onChange={(e) => setForm((current) => ({ ...current, timeline: e.target.value as EmailTemplateForm["timeline"] }))}
                            className="input-base"
                          >
                            {TIMELINES.map((timeline) => (
                              <option key={timeline.value} value={timeline.value}>
                                {timeline.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Delay minutes</label>
                          <input
                            type="number"
                            min={0}
                            value={form.delayMinutes}
                            onChange={(e) => setForm((current) => ({ ...current, delayMinutes: e.target.value }))}
                            className="input-base"
                            placeholder={form.timeline === "custom" ? "Minutes" : "Only used for custom timing"}
                            disabled={form.timeline !== "custom"}
                          />
                          <p className="mt-1 text-xs text-slate-400">Only used when timeline is set to custom.</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/25 bg-white/55 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/20">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">Subject</h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Subjects are sent with the {SUBJECT_PREFIX} prefix for clarity.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {EMAIL_TEMPLATE_FIELDS.map(({ key, label }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => insertPlaceholder(key, "subject")}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-primary-500 dark:hover:bg-primary-900/30"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <input
                        ref={subjectInputRef}
                        type="text"
                        value={form.subjectTemplate}
                        onChange={(e) => setForm((current) => ({ ...current, subjectTemplate: e.target.value }))}
                        className="input-base mt-4"
                        placeholder="e.g. Procurement request {{ticketId}} created"
                        required
                      />
                    </div>

                    <div className="rounded-2xl border border-white/25 bg-white/55 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/20">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">Body</h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Use the fields below to build the message without leaving this page.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {EMAIL_TEMPLATE_FIELDS.map(({ key, label }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => insertPlaceholder(key, "body")}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-primary-500 dark:hover:bg-primary-900/30"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <textarea
                        ref={bodyInputRef}
                        value={form.bodyTemplate}
                        onChange={(e) => setForm((current) => ({ ...current, bodyTemplate: e.target.value }))}
                        className="input-base mt-4 min-h-[160px]"
                        placeholder="Hi {{requesterName}}, your request {{ticketTitle}} has been created..."
                        required
                      />
                    </div>

                    <div className="rounded-2xl border border-white/25 bg-white/55 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/20">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">Recipients</h3>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">Extra recipients are added as CC on top of the primary workflow recipient.</p>
                        </div>
                        <Pill tone="neutral">CC only</Pill>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {form.extraRecipients.length > 0 ? (
                          form.extraRecipients.map((email) => (
                            <span
                              key={email}
                              className="inline-flex items-center gap-1 rounded-full border border-primary-300/40 bg-primary-100/30 px-3 py-1 text-xs font-medium text-primary-800 dark:border-primary-500/30 dark:bg-primary-900/20 dark:text-primary-300"
                            >
                              {email}
                              <button
                                type="button"
                                onClick={() => setForm((current) => ({ ...current, extraRecipients: current.extraRecipients.filter((item) => item !== email) }))}
                                className="rounded-full text-primary-500 hover:text-primary-700 dark:text-primary-300"
                                aria-label={`Remove ${email}`}
                              >
                                x
                              </button>
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-400">No extra recipients added.</span>
                        )}
                      </div>
                      <div className="mt-4 flex gap-2">
                        <input
                          type="email"
                          value={recipientInput}
                          onChange={(e) => setRecipientInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === ",") {
                              e.preventDefault();
                              addRecipientFromInput();
                            }
                          }}
                          className="input-base flex-1"
                          placeholder="email@example.com - press Enter or comma to add"
                        />
                        <button type="button" onClick={addRecipientFromInput} className="btn-secondary shrink-0">
                          Add
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/25 bg-white/55 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/20">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form.enabled}
                          onChange={(e) => setForm((current) => ({ ...current, enabled: e.target.checked }))}
                          className="h-4 w-4 rounded border-white/50 bg-white/60 text-primary-600 focus:ring-primary-500/30"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-200">Enabled (send this email when the trigger fires)</span>
                      </label>
                    </div>

                    {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
                  </div>

                  <div className="space-y-4">
                    <SectionCard title="Placeholder library" description="Click any chip to insert it at the current cursor position." bodyClassName="space-y-4">
                      {PLACEHOLDER_GROUPS.map((group) => (
                        <div key={group.title} className="rounded-2xl border border-white/20 bg-white/50 p-4 dark:border-white/10 dark:bg-slate-950/20">
                          <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">{group.title}</h4>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {group.keys.map((key) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => insertPlaceholder(key, "body")}
                                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-primary-500 dark:hover:bg-primary-900/30"
                              >
                                {FIELD_LABEL_BY_KEY.get(key) ?? key}
                                <span className="ml-1 text-[10px] text-slate-400">{`{{${key}}}`}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </SectionCard>

                    <SectionCard title="Template tips" description="A few small guardrails keep email templates easier to maintain.">
                      <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                        <li>Keep the subject short and action led.</li>
                        <li>Use the body for context, next steps, and any remarks.</li>
                        <li>Requester and CDO are always CC&apos;d by the delivery layer.</li>
                        <li>Extra recipients are appended as CC, not To.</li>
                      </ul>
                    </SectionCard>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 border-t border-white/20 pt-5">
                  <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? "Saving..." : editingId ? "Save changes" : "Add template"}
                  </button>
                  <button type="button" onClick={closeForm} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </form>
            </SectionCard>
          ) : null}

          <SectionCard
            title="Template library"
            description="Search the template library, narrow by group, and edit or delete templates from a compact card list."
            actions={
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-slate-500 dark:text-slate-300">
                  Showing {filteredTemplates.length} of {templates.length}
                </span>
                <button type="button" onClick={openAdd} className="btn-primary">
                  Add template
                </button>
                {(templateQuery || templateGroupFilter !== "all" || templateStatusFilter !== "all") && (
                  <button type="button" onClick={resetTemplateFilters} className="btn-secondary">
                    Clear filters
                  </button>
                )}
              </div>
            }
          >
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Search</label>
                <input
                  type="text"
                  value={templateQuery}
                  onChange={(e) => setTemplateQuery(e.target.value)}
                  className="input-base"
                  placeholder="Search name, trigger, subject, body, or recipients"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Group</label>
                <select
                  value={templateGroupFilter}
                  onChange={(e) => setTemplateGroupFilter(e.target.value as TemplateGroupFilter)}
                  className="input-base"
                >
                  <option value="all">All groups</option>
                  <option value="workflow">Workflow</option>
                  <option value="reminders">Reminders</option>
                  <option value="collaboration">Collaboration</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Status</label>
                <select
                  value={templateStatusFilter}
                  onChange={(e) => setTemplateStatusFilter(e.target.value as TemplateStatusFilter)}
                  className="input-base"
                >
                  <option value="all">All statuses</option>
                  <option value="enabled">Enabled</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">
              Search across the template name, trigger label, subject, body, and additional recipient list.
            </p>

            {loading ? (
              <div className="py-10 text-center text-slate-500 dark:text-slate-300">Loading...</div>
            ) : filteredTemplates.length === 0 ? (
              <div className="mt-4">
                {templates.length === 0 ? (
                  <EmptyStateCard
                    title="No templates yet"
                    description="Start by adding a template for the first workflow event."
                    action={
                      <button type="button" onClick={openAdd} className="btn-primary">
                        Add template
                      </button>
                    }
                  />
                ) : (
                  <EmptyStateCard
                    title="No templates match the current filters"
                    description="Try a broader search or clear the filters to see the full library."
                    action={
                      <button type="button" onClick={resetTemplateFilters} className="btn-primary">
                        Clear filters
                      </button>
                    }
                  />
                )}
              </div>
            ) : (
              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {filteredTemplates.map((template) => {
                  const triggerGroup = getTemplateGroup(template.trigger);
                  const recipients = splitRecipients(template.extraRecipients);
                  return (
                    <article
                      key={template.id}
                      className="rounded-3xl border border-white/30 border-l-4 bg-white/65 p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-900/35"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-900 dark:text-white">{template.name}</h3>
                            <Pill tone={template.enabled ? "success" : "neutral"}>{template.enabled ? "Enabled" : "Disabled"}</Pill>
                          </div>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                            {TRIGGER_LABEL_BY_VALUE.get(template.trigger) ?? template.trigger}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => openEdit(template)} className="text-sm font-medium text-primary-600 hover:text-primary-700">
                            Edit
                          </button>
                          <button type="button" onClick={() => handleDelete(template.id)} className="text-sm font-medium text-red-600 hover:text-red-700">
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Pill tone="info">{getTemplateGroupLabel(triggerGroup)}</Pill>
                        <Pill tone="neutral">{formatTimeline(template)}</Pill>
                        <Pill tone="neutral">{template.trigger}</Pill>
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/20 bg-white/45 p-4 dark:border-white/10 dark:bg-slate-950/20">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">Subject</p>
                          <p className="mt-2 break-words text-sm text-slate-700 dark:text-slate-200">{compactText(template.subjectTemplate, 140)}</p>
                        </div>
                        <div className="rounded-2xl border border-white/20 bg-white/45 p-4 dark:border-white/10 dark:bg-slate-950/20">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">Recipients</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {recipients.length > 0 ? (
                              recipients.map((email) => (
                                <Pill key={email} tone="neutral">
                                  {email}
                                </Pill>
                              ))
                            ) : (
                              <span className="text-sm text-slate-400">None</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/20 bg-white/45 p-4 dark:border-white/10 dark:bg-slate-950/20">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">Body preview</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{compactText(template.bodyTemplate, 220)}</p>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 dark:text-slate-400">
                        <span>Updated {formatTimestamp(template.updatedAt)}</span>
                        <span>Created {formatTimestamp(template.createdAt)}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      ) : null}
      {activeTab === "delivery" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="SMTP host" value={smtpForm.smtp_host || "Not set"} hint="Outgoing mail server" tone={smtpForm.smtp_host ? "success" : "warning"} />
            <MetricCard label="Sender" value={smtpForm.smtp_from || "Not set"} hint="From address" tone={smtpForm.smtp_from ? "success" : "warning"} />
            <MetricCard label="Proxy" value={smtpForm.smtp_proxy ? "Configured" : "Direct"} hint={smtpForm.smtp_proxy || "No proxy configured"} tone={smtpForm.smtp_proxy ? "info" : "default"} />
            <MetricCard label="Always CC" value="Requester + CDO" hint="Applied to every email" tone="info" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <SectionCard title="SMTP settings" description="Configure the outgoing mail server. These settings override environment variables.">
              <form onSubmit={handleSmtpSave} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">SMTP host</label>
                    <input
                      type="text"
                      value={smtpForm.smtp_host}
                      onChange={(e) => setSmtpForm((current) => ({ ...current, smtp_host: e.target.value }))}
                      className="input-base"
                      placeholder="e.g. smtp.sendgrid.net"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">SMTP port</label>
                    <input
                      type="text"
                      value={smtpForm.smtp_port}
                      onChange={(e) => setSmtpForm((current) => ({ ...current, smtp_port: e.target.value }))}
                      className="input-base"
                      placeholder="587 or 465"
                    />
                    <p className="mt-1 text-xs text-slate-400">587 = STARTTLS | 465 = SSL</p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">From address</label>
                    <input
                      type="email"
                      value={smtpForm.smtp_from}
                      onChange={(e) => setSmtpForm((current) => ({ ...current, smtp_from: e.target.value }))}
                      className="input-base"
                      placeholder="noreply@yourcompany.com"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">SMTP username</label>
                    <input
                      type="text"
                      value={smtpForm.smtp_user}
                      onChange={(e) => setSmtpForm((current) => ({ ...current, smtp_user: e.target.value }))}
                      className="input-base"
                      placeholder="apikey or email"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">SMTP password / API key</label>
                    <input
                      type="password"
                      value={smtpForm.smtp_pass}
                      onChange={(e) => setSmtpForm((current) => ({ ...current, smtp_pass: e.target.value }))}
                      className="input-base"
                      placeholder="Enter password or API key"
                      autoComplete="new-password"
                    />
                    <p className="mt-1 text-xs text-slate-400">Leave this field unchanged to keep the current password. Enter a new value only if you want to replace it.</p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Proxy URL <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={smtpForm.smtp_proxy}
                      onChange={(e) => setSmtpForm((current) => ({ ...current, smtp_proxy: e.target.value }))}
                      className="input-base"
                      placeholder="http://proxy-host:8080 or socks5://proxy-host:1080"
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      Use this if the server cannot reach the SMTP host directly. Supports HTTP CONNECT and SOCKS4/SOCKS5 proxies.
                    </p>
                  </div>
                </div>
                {smtpResult ? <p className={`text-sm font-medium ${smtpResult.ok ? "text-emerald-600" : "text-red-600"}`}>{smtpResult.message}</p> : null}
                <button type="submit" disabled={smtpSaving} className="btn-primary">
                  {smtpSaving ? "Saving..." : "Save SMTP settings"}
                </button>
              </form>
            </SectionCard>

            <div className="space-y-6">
              <SectionCard title="Delivery rules" description="These rules apply to every automated email sent from the platform.">
                <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
                  <div className="rounded-2xl border border-white/20 bg-white/45 p-4 dark:border-white/10 dark:bg-slate-950/20">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">Subject prefix</p>
                    <p className="mt-2">All subjects are sent with the {SUBJECT_PREFIX} prefix so recipients know the message came from the platform.</p>
                  </div>
                  <div className="rounded-2xl border border-white/20 bg-white/45 p-4 dark:border-white/10 dark:bg-slate-950/20">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">Always CC</p>
                    <p className="mt-2">Requester and CDO are always copied on every workflow email.</p>
                  </div>
                  <div className="rounded-2xl border border-white/20 bg-white/45 p-4 dark:border-white/10 dark:bg-slate-950/20">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">Extra recipients</p>
                    <p className="mt-2">Any extra recipients added in the template editor are also treated as CC recipients, not primary recipients.</p>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Send test email" description="Use this to verify SMTP settings before relying on automated workflow emails.">
                <form onSubmit={handleSendTestEmail} className="space-y-4">
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
                      className="input-base min-h-[120px]"
                      placeholder="Test email body..."
                    />
                  </div>
                  {testResult ? <p className={`text-sm font-medium ${testResult.ok ? "text-emerald-600" : "text-red-600"}`}>{testResult.message}</p> : null}
                  <button type="submit" disabled={testSending} className="btn-primary">
                    {testSending ? "Sending..." : "Send test email"}
                  </button>
                </form>
              </SectionCard>
            </div>
          </div>
        </div>
      ) : null}
      {activeTab === "diagnostics" ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
            <MetricCard label="Total emails" value={stats?.total ?? "-"} hint="All recorded sends" tone="info" />
            <MetricCard label="Last 24h" value={stats?.last24h ?? "-"} hint="Recent activity" tone="success" />
            <MetricCard label="Last 7d" value={stats?.last7d ?? "-"} hint="Weekly activity" tone="warning" />
            <MetricCard label="Log rows" value={logs.length} hint="Most recent messages" />
          </div>

          <SectionCard
            title="Email activity"
            description="Review recent messages sent by the system. Payloads stay hidden until you expand a row."
            actions={
              <button type="button" onClick={loadLogs} className="btn-secondary">
                Refresh
              </button>
            }
          >
            {logsLoading ? (
              <div className="py-10 text-center text-slate-500 dark:text-slate-300">Loading...</div>
            ) : logs.length === 0 ? (
              <EmptyStateCard title="No emails sent yet" description="Once the workflow sends messages, the latest activity will appear here." />
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <article key={log.id} className="rounded-3xl border border-white/25 bg-white/55 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/20">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{log.recipient}</p>
                          <Pill tone="info">{log.type.replace(/_/g, " ")}</Pill>
                        </div>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{log.ticketTitle ?? log.ticketId}</p>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-400">{formatTimestamp(log.sentAt)}</p>
                    </div>
                    {log.payload ? (
                      <details className="mt-4 rounded-2xl border border-white/20 bg-white/40 px-4 py-3 dark:border-white/10 dark:bg-slate-950/20">
                        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">Payload</summary>
                        <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-300">{log.payload}</pre>
                      </details>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
