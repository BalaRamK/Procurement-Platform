"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Action = "approved" | "rejected" | "submit" | "mark_delivered" | "confirm_receipt";

export function TicketActions({
  ticketId,
  status,
  isRequester,
  isProduction,
}: {
  ticketId: string;
  status: string;
  isRequester: boolean;
  isProduction: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<Action | null>(null);
  const [rejectionRemarks, setRejectionRemarks] = useState("");
  const [showReject, setShowReject] = useState(false);

  async function act(action: Action, payload?: { remarks?: string }) {
    setLoading(action);
    try {
      const res = await fetch("/api/requests/" + ticketId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "rejected" ? { action, remarks: payload?.remarks ?? rejectionRemarks } : { action }
        ),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed");
      }
      setShowReject(false);
      setRejectionRemarks("");
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  if (status === "DRAFT" && isRequester) {
    return (
      <button
        type="button"
        onClick={() => act("submit")}
        disabled={!!loading}
        className="btn-primary"
      >
        {loading === "submit" ? "Submitting…" : "Submit for approval"}
      </button>
    );
  }

  if (status === "DELIVERED_TO_REQUESTER" && isRequester) {
    return (
      <button
        type="button"
        onClick={() => act("confirm_receipt")}
        disabled={!!loading}
        className="btn-success"
      >
        {loading === "confirm_receipt" ? "Processing…" : "Confirm receipt & close"}
      </button>
    );
  }

  if (status === "ASSIGNED_TO_PRODUCTION" && isProduction) {
    return (
      <button
        type="button"
        onClick={() => act("mark_delivered")}
        disabled={!!loading}
        className="btn-primary"
      >
        {loading === "mark_delivered" ? "Processing…" : "Mark as delivered"}
      </button>
    );
  }

  const approvalStatuses = [
    "PENDING_FH_APPROVAL",
    "PENDING_L1_APPROVAL",
    "PENDING_CFO_APPROVAL",
    "PENDING_CDO_APPROVAL",
  ];
  if (!approvalStatuses.includes(status)) return null;

  if (showReject) {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-700">Rejection remarks (mandatory)</label>
        <textarea
          value={rejectionRemarks}
          onChange={(e) => setRejectionRemarks(e.target.value)}
          className="input-base min-h-[80px]"
          placeholder="Reason for rejection…"
          rows={3}
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => act("rejected")}
            disabled={!!loading || !rejectionRemarks.trim()}
            className="btn-danger"
          >
            {loading === "rejected" ? "Processing…" : "Reject"}
          </button>
          <button type="button" onClick={() => setShowReject(false)} className="btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => act("approved")}
        disabled={!!loading}
        className="btn-success"
      >
        {loading === "approved" ? "Processing…" : "Approve"}
      </button>
      <button
        type="button"
        onClick={() => setShowReject(true)}
        disabled={!!loading}
        className="btn-danger"
      >
        Reject
      </button>
    </div>
  );
}
