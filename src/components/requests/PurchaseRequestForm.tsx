"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { TeamName, CostCurrency, Priority } from "@/types/db";
import { PageHeader } from "@/components/layout/PageHeader";

const TEAMS: { value: TeamName; label: string }[] = [
  { value: "INNOVATION", label: "Innovation" },
  { value: "ENGINEERING", label: "Engineering" },
  { value: "SALES", label: "Sales" },
];

const CURRENCIES: { value: CostCurrency; label: string }[] = [
  { value: "USD", label: "USD" },
  { value: "INR", label: "INR" },
  { value: "EUR", label: "EUR" },
];

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

/** Map flow steps by team (constant per team) */
const TEAM_FLOW_STEPS: Record<TeamName, string[]> = {
  INNOVATION: ["Requester", "Functional Head", "L1 Approver", "CFO"],
  ENGINEERING: ["Requester", "Functional Head", "L1 Approver", "CFO"],
  SALES: ["Requester", "Functional Head", "L1 Approver", "CDO"],
};

type FlowAssignee = { name: string | null; email: string } | null;
type FlowAssignees = {
  functionalHead: FlowAssignee;
  l1Approver: FlowAssignee;
  cfo: FlowAssignee;
  cdo: FlowAssignee;
};

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="card-header border-b border-white/20 px-6 py-4 dark:border-white/10">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function FormField({
  label,
  required,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

type Props = { requesterName: string; requesterEmail: string };

export function PurchaseRequestForm({ requesterName, requesterEmail }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requesterNameVal, setRequesterNameVal] = useState(requesterName);
  const [department, setDepartment] = useState("");
  const [componentDescription, setComponentDescription] = useState("");
  const [bomId, setBomId] = useState("");
  const [productId, setProductId] = useState("");
  const [itemName, setItemName] = useState("");
  const [projectCustomer, setProjectCustomer] = useState("");
  const [needByDate, setNeedByDate] = useState("");
  const [chargeCode, setChargeCode] = useState("");
  const [costCurrency, setCostCurrency] = useState<CostCurrency>("USD");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [rate, setRate] = useState("");
  const [unit, setUnit] = useState("");
  const [estimatedPODate, setEstimatedPODate] = useState("");
  const [placeOfDelivery, setPlaceOfDelivery] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [dealName, setDealName] = useState("");
  const [dealId, setDealId] = useState("");
  const [teamName, setTeamName] = useState<TeamName>("ENGINEERING");

  const currentChargeCodes = chargeCodesByTeam[teamName] ?? [];
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [zohoLocked, setZohoLocked] = useState(false);
  const [manualAddMode, setManualAddMode] = useState(false); // + Add Component: user enters details manually (not in Zoho)
  const [flowAssignees, setFlowAssignees] = useState<FlowAssignees | null>(null);
  const [projectNames, setProjectNames] = useState<string[]>([]);
  const [chargeCodesByTeam, setChargeCodesByTeam] = useState<Record<TeamName, string[]>>({
    INNOVATION: [],
    ENGINEERING: [],
    SALES: [],
  });
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/flow-assignees?team=" + encodeURIComponent(teamName))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setFlowAssignees(data);
      })
      .catch(() => {
        if (!cancelled) setFlowAssignees(null);
      });
    return () => { cancelled = true; };
  }, [teamName]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/request-options")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.projectNames) setProjectNames(data.projectNames);
        if (data?.chargeCodesByTeam) setChargeCodesByTeam(data.chargeCodesByTeam);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const lookupSku = useCallback(async (sku: string) => {
    if (!sku.trim()) return;
    setLookupError("");
    setLookupLoading(true);
    try {
      const res = await fetch("/api/zoho/items?sku=" + encodeURIComponent(sku.trim()));
      const data = await res.json();
      if (!res.ok) {
        setLookupError((data as { error?: string }).error ?? "Lookup failed");
        return;
      }
      if (data.found) {
        setItemName(data.name ?? "");
        setRate(data.rate != null ? String(data.rate) : "");
        setUnit(data.unit ?? "");
        setZohoLocked(true);
      } else {
        setItemName("");
        setRate("");
        setUnit("");
        setZohoLocked(false);
      }
    } catch {
      setLookupError("Network error");
    } finally {
      setLookupLoading(false);
    }
  }, []);

  const onBomBlur = () => {
    if (bomId.trim()) lookupSku(bomId.trim());
  };
  const onProductBlur = () => {
    if (productId.trim()) lookupSku(productId.trim());
  };

  const qtyNum = quantity ? Number(quantity) || 1 : 1;
  const displayCost = rate ? String(Number(rate) * qtyNum) : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLookupError("");
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Purchase Request",
          description: description || undefined,
          requesterName: requesterNameVal || requesterEmail,
          department: department || undefined,
          componentDescription: componentDescription || undefined,
          bomId: bomId || undefined,
          productId: productId || undefined,
          itemName: itemName || undefined,
          projectCustomer: projectCustomer || undefined,
          needByDate: needByDate || undefined,
          chargeCode: chargeCode || undefined,
          costCurrency,
          estimatedCost: rate ? Number(rate) * qtyNum : undefined,
          rate: rate ? Number(rate) : undefined,
          unit: unit || undefined,
          estimatedPODate: estimatedPODate || undefined,
          placeOfDelivery: placeOfDelivery || undefined,
          quantity: quantity ? Number(quantity) : undefined,
          dealName: dealName || undefined,
          teamName,
          priority,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      const ticket = await res.json();
      router.push("/requests/" + ticket.id);
      router.refresh();
    } catch {
      setLookupError("Failed to create request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader backHref="/dashboard" backLabel="Back to Dashboard" />

      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Please fill the details to raise a new Request
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Request Info */}
        <SectionCard title="Request Info">
          <div className="grid gap-6 sm:grid-cols-2">
            <FormField label="Title" required>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-base"
                placeholder="e.g. Office supplies Q1"
                required
              />
            </FormField>
            <FormField label="Requester Name" required>
              <input
                type="text"
                value={requesterNameVal}
                onChange={(e) => setRequesterNameVal(e.target.value)}
                className="input-base"
                placeholder="Autofill"
                required
              />
            </FormField>
            <FormField label="Department" required>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="input-base"
                placeholder="e.g. Engineering"
                required
              />
            </FormField>
            <FormField label="Team" required>
              <select
                value={teamName}
                onChange={(e) => {
                  const next = e.target.value as TeamName;
                  setTeamName(next);
                  const nextCodes = chargeCodesByTeam[next] ?? [];
                  if (chargeCode && nextCodes.length > 0 && !nextCodes.includes(chargeCode)) {
                    setChargeCode("");
                  }
                }}
                className="input-base"
                required
              >
                {TEAMS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Priority">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="input-base"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Place of Delivery" className="sm:col-span-2">
              <input
                type="text"
                value={placeOfDelivery}
                onChange={(e) => setPlaceOfDelivery(e.target.value)}
                className="input-base"
                placeholder="Global auto search"
              />
            </FormField>
          </div>
        </SectionCard>

        {/* Item Info */}
        <SectionCard title="Item Info">
          <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
              <FormField label="Component Name" className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    value={componentDescription || itemName}
                    onChange={(e) => {
                      setComponentDescription(e.target.value);
                      if (!zohoLocked) setItemName(e.target.value);
                    }}
                    onBlur={() => !manualAddMode && componentDescription.trim() && lookupSku(componentDescription.trim())}
                    className="input-base pr-10"
                    placeholder={manualAddMode ? "Enter component name (not in Zoho)" : "Search in Zoho"}
                    readOnly={manualAddMode ? false : undefined}
                  />
                  {!manualAddMode && (
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </span>
                  )}
                </div>
              </FormField>
              <button
                type="button"
                onClick={() => {
                  setManualAddMode(true);
                  setZohoLocked(false);
                  setLookupError("");
                }}
                className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 whitespace-nowrap"
              >
                + Add Component
              </button>
            </div>
            {manualAddMode && (
              <p className="text-sm text-slate-500 dark:text-slate-300">
                Enter item details manually below (BOM ID, Product ID, Cost per item, etc.). Leave blank if not applicable.
              </p>
            )}

            <div className="grid gap-6 sm:grid-cols-2">
              <FormField label="BOM ID">
                <input
                  type="text"
                  value={bomId}
                  onChange={(e) => setBomId(e.target.value)}
                  onBlur={onBomBlur}
                  disabled={zohoLocked}
                  className="input-base"
                  placeholder="Autofill/generate if not in Zoho"
                />
              </FormField>
              <FormField label="Product ID">
                <input
                  type="text"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  onBlur={onProductBlur}
                  disabled={zohoLocked}
                  className="input-base"
                  placeholder="Autofill/generate if not in Zoho"
                />
              </FormField>
              <FormField label="Cost per item ($)" required>
                <input
                  type="number"
                  step="any"
                  min={0}
                  value={rate}
                  onChange={(e) => !zohoLocked && setRate(e.target.value)}
                  readOnly={zohoLocked}
                  className="input-base read-only:bg-white/40 read-only:border-white/40 dark:read-only:bg-white/5 dark:read-only:border-white/10"
                  placeholder="Autofill/ Add manually if not in Zoho"
                  required
                />
              </FormField>
              <FormField label="Quantity" required>
                <div className="flex items-stretch rounded-2xl border border-white/30 bg-white/35 shadow-[var(--glass-inner)] dark:border-white/10 dark:bg-white/5">
                  <input
                    type="number"
                    min={1}
                    max={9999}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="input-base w-20 min-w-0 flex-1 rounded-r-none border-0 border-r border-white/25 bg-transparent dark:border-white/10"
                    required
                  />
                  <div className="flex flex-col border-l border-white/25 dark:border-white/10">
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => setQuantity(String(Math.min(9999, (Number(quantity) || 1) + 1)))}
                      className="flex flex-1 items-center justify-center px-2 text-slate-500 hover:bg-white/30 hover:text-slate-800 dark:hover:bg-white/10 dark:hover:text-slate-200 rounded-tr-2xl"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => setQuantity(String(Math.max(1, (Number(quantity) || 2) - 1)))}
                      className="flex flex-1 items-center justify-center px-2 text-slate-500 hover:bg-white/30 hover:text-slate-800 dark:hover:bg-white/10 dark:hover:text-slate-200 rounded-br-2xl"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                </div>
              </FormField>
            </div>

            <FormField label="Item Description" required>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-base min-h-[100px] resize-y"
                placeholder="Multiple lines"
                rows={3}
                required
              />
            </FormField>

            <div className="grid gap-6 sm:grid-cols-2">
              <FormField label="Estimated Cost" required>
                <input
                  type="text"
                  value={displayCost}
                  readOnly
                  className="input-base read-only:bg-white/40 read-only:border-white/40 dark:read-only:bg-white/5 dark:read-only:border-white/10"
                  placeholder="Auto Calculate (Cost per item × Quantity)"
                />
              </FormField>
              <FormField label="Need by">
                <div className="relative">
                  <input
                    type="date"
                    value={needByDate}
                    onChange={(e) => setNeedByDate(e.target.value)}
                    className="input-base pr-10 date-picker-visible"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </span>
                </div>
              </FormField>
            </div>

            {lookupLoading && (
              <p className="text-sm text-slate-500 dark:text-slate-300">Looking up in Zoho Books…</p>
            )}
            {lookupError && (
              <p className="text-sm text-red-600 dark:text-red-400">{lookupError}</p>
            )}
          </div>
        </SectionCard>

        {/* Project Info */}
        <SectionCard title="Project Info">
          <div className="grid gap-6 sm:grid-cols-2">
            <FormField label="Project/Customer Name">
              <div className="relative">
                <input
                  type="text"
                  list="project-customer-list"
                  value={projectCustomer}
                  onChange={(e) => setProjectCustomer(e.target.value)}
                  className="input-base pr-10"
                  placeholder={projectNames.length ? "Search or select..." : "Add options in Admin → Products & charge codes"}
                />
                <datalist id="project-customer-list">
                  {projectNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
              </div>
            </FormField>
            <FormField label="Charge Code">
              {currentChargeCodes.length > 0 ? (
                <select
                  value={chargeCode}
                  onChange={(e) => setChargeCode(e.target.value)}
                  className="input-base"
                >
                  <option value="">Select charge code</option>
                  {currentChargeCodes.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={chargeCode}
                  onChange={(e) => setChargeCode(e.target.value)}
                  className="input-base"
                  placeholder="Add charge codes in Admin for this team"
                />
              )}
            </FormField>
            <FormField label="Deal Name">
              <input
                type="text"
                value={dealName}
                onChange={(e) => setDealName(e.target.value)}
                className="input-base"
                placeholder="Autofill from Zoho CRM"
              />
            </FormField>
            <FormField label="Deal ID">
              <input
                type="text"
                value={dealId}
                onChange={(e) => setDealId(e.target.value)}
                className="input-base"
                placeholder="Autofill from Zoho CRM"
              />
            </FormField>
            <FormField label="Estimated PO Date">
              <div className="relative">
                <input
                  type="date"
                  value={estimatedPODate}
                  onChange={(e) => setEstimatedPODate(e.target.value)}
                  className="input-base pr-10 date-picker-visible"
                  placeholder="Date picker"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
              </div>
            </FormField>
          </div>
        </SectionCard>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? "Creating…" : "Create Request"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>

        {/* Map Flow – shown when Team is set; includes name/email per step */}
        {teamName && (
          <SectionCard title="Map Flow">
            <div className="flex flex-wrap items-center justify-center gap-2 py-4 sm:gap-4">
              {TEAM_FLOW_STEPS[teamName].map((label, i) => {
                const isLast = i === TEAM_FLOW_STEPS[teamName].length - 1;
                let nameEmail = "";
                if (i === 0) {
                  nameEmail = requesterNameVal ? `${requesterNameVal} (${requesterEmail})` : requesterEmail || "—";
                } else if (i === 1 && flowAssignees?.functionalHead) {
                  nameEmail = flowAssignees.functionalHead.name
                    ? `${flowAssignees.functionalHead.name} (${flowAssignees.functionalHead.email})`
                    : flowAssignees.functionalHead.email;
                } else if (i === 2 && flowAssignees?.l1Approver) {
                  nameEmail = flowAssignees.l1Approver.name
                    ? `${flowAssignees.l1Approver.name} (${flowAssignees.l1Approver.email})`
                    : flowAssignees.l1Approver.email;
                } else if (i === 3) {
                  const last = teamName === "SALES" ? flowAssignees?.cdo : flowAssignees?.cfo;
                  nameEmail = last
                    ? (last.name ? `${last.name} (${last.email})` : last.email)
                    : "—";
                }
                return (
                  <div key={i} className="flex items-center gap-2 sm:gap-4">
                    <div
                      className="flex min-w-0 max-w-[140px] flex-col items-center justify-center rounded-2xl border-2 border-white/30 bg-white/20 px-2 py-3 dark:border-white/10 dark:bg-white/5 sm:max-w-[180px] sm:px-3"
                      title={label + (nameEmail ? ": " + nameEmail : "")}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 sm:text-xs">
                        {label}
                      </span>
                      <span className="mt-0.5 truncate text-center text-[10px] text-slate-500 dark:text-slate-400 sm:text-xs">
                        {nameEmail || "—"}
                      </span>
                    </div>
                    {!isLast && (
                      <span className="text-slate-400 dark:text-slate-500" aria-hidden>&#8594;</span>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}
      </form>
    </div>
  );
}
