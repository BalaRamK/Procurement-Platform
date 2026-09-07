"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Action =
  | "approved"
  | "rejected"
  | "submit"
  | "reraised"
  | "order_placed"
  | "mark_delivered"
  | "confirm_receipt"
  | "delete_draft"
  | "request_alternate_quote"
  | "submit_alternate_quote";

export function TicketActions({
  ticketId,
  status,
  isRequester,
  isProduction,
  isFinanceApprover = false,
  alternateQuoteState = null,
  canDeleteTicket = false,
  canApproveActions = true,
}: {
  ticketId: string;
  status: string;
  isRequester: boolean;
  isProduction: boolean;
  isFinanceApprover?: boolean;
  alternateQuoteState?: string | null;
  canDeleteTicket?: boolean;
  canApproveActions?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<Action | null>(null);
  const [rejectionRemarks, setRejectionRemarks] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [quoteRemarks, setQuoteRemarks] = useState("");
  const [error, setError] = useState("");

  async function act(action: Action, payload?: { remarks?: string }) {
    if (
      action === "confirm_receipt" &&
      !window.confirm("Confirm that you have received the requested item? This will close the ticket.")
    ) {
      return;
    }

    setLoading(action);
    setError("");
    try {
      const res = await fetch("/api/requests/" + ticketId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "rejected"
            ? { action, remarks: payload?.remarks ?? rejectionRemarks }
            : action === "submit_alternate_quote"
              ? { action, remarks: payload?.remarks ?? quoteRemarks }
              : { action }
        ),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Action failed. Please try again.");
      }
      setShowReject(false);
      setRejectionRemarks("");
      setQuoteRemarks("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  async function deleteTicket() {
    const label = status === "DRAFT" ? "draft request" : "ticket";
    if (!window.confirm(`Delete this ${label} permanently? This cannot be undone.`)) {
      return;
    }

    setLoading("delete_draft");
    setError("");
    try {
      const res = await fetch("/api/requests/" + ticketId, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Could not delete this ticket. Please try again.");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this ticket. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  const errorMessage = error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null;

  if (status === "DRAFT" && isRequester) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <Link href={`/requests/${ticketId}/edit`} className="btn-secondary">
            Edit draft
          </Link>
          <button type="button" onClick={() => act("submit")} disabled={!!loading} className="btn-primary">
            {loading === "submit" ? "Submitting..." : "Submit for approval"}
          </button>
          <button type="button" onClick={() => void deleteTicket()} disabled={!!loading} className="btn-danger">
            {loading === "delete_draft" ? "Deleting..." : "Delete draft"}
          </button>
        </div>
        {errorMessage}
      </div>
    );
  }

  if (status === "DELIVERED_TO_REQUESTER" && isRequester) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => act("confirm_receipt")} disabled={!!loading} className="btn-success">
          {loading === "confirm_receipt" ? "Processing..." : "Confirm received and close"}
        </button>
        {errorMessage}
      </div>
    );
  }

  if (status === "REJECTED" && isRequester) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => act("reraised")} disabled={!!loading} className="btn-primary">
          {loading === "reraised" ? "Processing..." : "Re-Raise request"}
        </button>
        {canDeleteTicket && (
          <button type="button" onClick={() => void deleteTicket()} disabled={!!loading} className="btn-danger">
            {loading === "delete_draft" ? "Deleting..." : "Delete ticket"}
          </button>
        )}
        {errorMessage}
      </div>
    );
  }

  if (status === "ASSIGNED_TO_PRODUCTION" && isProduction) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => act("order_placed")} disabled={!!loading} className="btn-primary">
          {loading === "order_placed" ? "Processing..." : "Order placed"}
        </button>
        {errorMessage}
      </div>
    );
  }

  if (status === "ORDER_PLACED" && isProduction) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => act("mark_delivered")} disabled={!!loading} className="btn-primary">
          {loading === "mark_delivered" ? "Processing..." : "Mark as delivered"}
        </button>
        {errorMessage}
      </div>
    );
  }

  if (status === "PENDING_FINANCE_APPROVAL" && isProduction && alternateQuoteState === "REQUESTED") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Finance has requested an alternate quote for this request. Upload the quote(s) below, then mark this done.
        </p>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Notes for Finance (optional)</label>
        <textarea
          value={quoteRemarks}
          onChange={(e) => setQuoteRemarks(e.target.value)}
          className="input-base min-h-[80px]"
          placeholder="e.g. Attached two alternate supplier quotes for comparison."
          rows={3}
        />
        <button type="button" onClick={() => act("submit_alternate_quote")} disabled={!!loading} className="btn-primary">
          {loading === "submit_alternate_quote" ? "Submitting..." : "Mark alternate quote submitted"}
        </button>
        {errorMessage}
      </div>
    );
  }

  if (status === "PENDING_FINANCE_APPROVAL" && isFinanceApprover && alternateQuoteState === "REQUESTED") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Waiting for the Procurement Team to upload an alternate quote. Approve/Reject will be available again once they mark it submitted.
        </p>
        {errorMessage}
      </div>
    );
  }

  if (status === "PENDING_FINANCE_APPROVAL" && isFinanceApprover && canApproveActions) {
    return (
      <div className="space-y-3">
        {alternateQuoteState === "SUBMITTED" && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            The Procurement Team submitted an alternate quote — review the attachments below before deciding.
          </p>
        )}
        {showReject ? (
          <>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Rejection remarks (mandatory)</label>
            <textarea
              value={rejectionRemarks}
              onChange={(e) => setRejectionRemarks(e.target.value)}
              className="input-base min-h-[80px]"
              placeholder="Reason for rejection..."
              rows={3}
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => act("rejected")}
                disabled={!!loading || !rejectionRemarks.trim()}
                className="btn-danger"
              >
                {loading === "rejected" ? "Processing..." : "Reject"}
              </button>
              <button type="button" onClick={() => setShowReject(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => act("approved")} disabled={!!loading} className="btn-success">
              {loading === "approved" ? "Processing..." : "Approve"}
            </button>
            <button type="button" onClick={() => setShowReject(true)} disabled={!!loading} className="btn-danger">
              Reject
            </button>
            <button
              type="button"
              onClick={() => act("request_alternate_quote")}
              disabled={!!loading}
              className="btn-secondary"
            >
              {loading === "request_alternate_quote" ? "Requesting..." : "Get alternate quote"}
            </button>
            {canDeleteTicket && (
              <button type="button" onClick={() => void deleteTicket()} disabled={!!loading} className="btn-danger">
                {loading === "delete_draft" ? "Deleting..." : "Delete ticket"}
              </button>
            )}
          </div>
        )}
        {errorMessage}
      </div>
    );
  }

  const approvalStatuses = [
    "PENDING_FH_APPROVAL",
    "PENDING_L1_APPROVAL",
    "PENDING_FINANCE_APPROVAL",
    "PENDING_CFO_APPROVAL",
    "PENDING_CDO_APPROVAL",
  ];
  if (!approvalStatuses.includes(status)) {
    if (!canDeleteTicket) return null;
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => void deleteTicket()} disabled={!!loading} className="btn-danger">
          {loading === "delete_draft" ? "Deleting..." : "Delete ticket"}
        </button>
        {errorMessage}
      </div>
    );
  }
  if (!canApproveActions) {
    if (!canDeleteTicket) return null;
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => void deleteTicket()} disabled={!!loading} className="btn-danger">
          {loading === "delete_draft" ? "Deleting..." : "Delete ticket"}
        </button>
        {errorMessage}
      </div>
    );
  }

  if (showReject) {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Rejection remarks (mandatory)</label>
        <textarea
          value={rejectionRemarks}
          onChange={(e) => setRejectionRemarks(e.target.value)}
          className="input-base min-h-[80px]"
          placeholder="Reason for rejection..."
          rows={3}
        />
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => act("rejected")}
            disabled={!!loading || !rejectionRemarks.trim()}
            className="btn-danger"
          >
            {loading === "rejected" ? "Processing..." : "Reject"}
          </button>
          <button type="button" onClick={() => setShowReject(false)} className="btn-secondary">
            Cancel
          </button>
        </div>
        {errorMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => act("approved")} disabled={!!loading} className="btn-success">
          {loading === "approved" ? "Processing..." : "Approve"}
        </button>
        <button type="button" onClick={() => setShowReject(true)} disabled={!!loading} className="btn-danger">
          Reject
        </button>
        {canDeleteTicket && (
          <button type="button" onClick={() => void deleteTicket()} disabled={!!loading} className="btn-danger">
            {loading === "delete_draft" ? "Deleting..." : "Delete ticket"}
          </button>
        )}
      </div>
      {errorMessage}
    </div>
  );
}
