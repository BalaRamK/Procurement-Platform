"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { TeamName, CostCurrency, Priority } from "@prisma/client";

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
  const [quantity, setQuantity] = useState("");
  const [dealName, setDealName] = useState("");
  const [teamName, setTeamName] = useState<TeamName>("ENGINEERING");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [zohoLocked, setZohoLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");

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

  const onBomBlur = () => { if (bomId.trim()) lookupSku(bomId.trim()); };
  const onProductBlur = () => { if (productId.trim()) lookupSku(productId.trim()); };

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
          estimatedCost: estimatedCost ? Number(estimatedCost) : (rate ? Number(rate) : undefined),
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
    <div>
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">← Back to Dashboard</Link>
      </div>
      <form onSubmit={handleSubmit} className="card divide-y divide-white/20">
        <div className="px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">New purchase request</h2>
          <p className="mt-1 text-sm text-slate-500">Mandatory fields: Requester Name, Department, Item Description, Estimated Cost. Team (Innovation/Engineering/Sales) determines approval route.</p>
        </div>
        <div className="space-y-6 px-6 py-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input-base" placeholder="e.g. Office supplies Q1" required />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Requester name *</label>
              <input type="text" value={requesterNameVal} onChange={(e) => setRequesterNameVal(e.target.value)} className="input-base" required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Department *</label>
              <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} className="input-base" placeholder="e.g. Engineering" required />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Item description *</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input-base min-h-[80px] resize-y" placeholder="Describe the item or request" rows={3} required />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Component description</label>
            <input type="text" value={componentDescription} onChange={(e) => setComponentDescription(e.target.value)} className="input-base" placeholder="Optional" />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">BOM ID</label>
              <input type="text" value={bomId} onChange={(e) => setBomId(e.target.value)} onBlur={onBomBlur} disabled={zohoLocked} className="input-base" placeholder="Lookup in Zoho" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Product ID</label>
              <input type="text" value={productId} onChange={(e) => setProductId(e.target.value)} onBlur={onProductBlur} disabled={zohoLocked} className="input-base" placeholder="Lookup in Zoho" />
            </div>
          </div>
          {lookupLoading && <p className="text-sm text-slate-500">Looking up in Zoho Books…</p>}
          {lookupError && <p className="text-sm text-red-600">{lookupError}</p>}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Item name (from Zoho)</label>
            <input type="text" value={itemName} onChange={(e) => !zohoLocked && setItemName(e.target.value)} readOnly={zohoLocked} className="input-base read-only:bg-white/40 read-only:border-white/40" />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Project / Customer</label>
              <input type="text" value={projectCustomer} onChange={(e) => setProjectCustomer(e.target.value)} className="input-base" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Need by date</label>
              <input type="date" value={needByDate} onChange={(e) => setNeedByDate(e.target.value)} className="input-base" />
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Charge code</label>
              <input type="text" value={chargeCode} onChange={(e) => setChargeCode(e.target.value)} className="input-base" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Cost currency</label>
              <select value={costCurrency} onChange={(e) => setCostCurrency(e.target.value as CostCurrency)} className="input-base">
                {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Estimated cost *</label>
              <input type="number" step="any" value={estimatedCost || rate} onChange={(e) => !zohoLocked && setEstimatedCost(e.target.value)} readOnly={zohoLocked} className="input-base read-only:bg-white/40 read-only:border-white/40" placeholder="0.00" required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Unit</label>
              <input type="text" value={unit} onChange={(e) => !zohoLocked && setUnit(e.target.value)} readOnly={zohoLocked} className="input-base read-only:bg-white/40 read-only:border-white/40" placeholder="pcs, kg" />
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Estimated PO date</label>
              <input type="date" value={estimatedPODate} onChange={(e) => setEstimatedPODate(e.target.value)} className="input-base" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Place of delivery</label>
              <input type="text" value={placeOfDelivery} onChange={(e) => setPlaceOfDelivery(e.target.value)} className="input-base" />
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Quantity *</label>
              <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="input-base" placeholder="1" required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Deal name (from CRM)</label>
              <input type="text" value={dealName} onChange={(e) => setDealName(e.target.value)} className="input-base" />
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Team (Request type) *</label>
              <select value={teamName} onChange={(e) => setTeamName(e.target.value as TeamName)} className="input-base" required>
                {TEAMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-500">Sales → L1 Sales; Engineering/Innovation → FH then L1.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="input-base">
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 border-t border-white/30 bg-white/40 px-6 py-4 backdrop-blur-sm">
          <button type="submit" disabled={loading} className="btn-primary">{loading ? "Creating…" : "Create request"}</button>
          <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}
