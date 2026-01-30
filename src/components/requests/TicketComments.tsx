"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  user: { email: string | null; name: string | null };
};

export function TicketComments({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/requests/" + ticketId + "/comments")
      .then((res) => res.ok ? res.json() : [])
      .then((data) => { setComments(Array.isArray(data) ? data : []); })
      .finally(() => setLoading(false));
  }, [ticketId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/requests/" + ticketId + "/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      const comment = await res.json();
      setComments((prev) => [...prev, comment]);
      setBody("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="card-header border-b px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Internal comments</h2>
        <p className="mt-1 text-sm text-slate-500">Approvals and clarifications.</p>
      </div>
      <div className="divide-y divide-white/20">
        {loading ? (
          <div className="px-6 py-8 text-center text-slate-500">Loading…</div>
        ) : comments.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-500">No comments yet.</div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="px-6 py-4">
              <p className="text-sm text-slate-900">{c.body}</p>
              <p className="mt-1 text-xs text-slate-500">
                {c.user.name ?? c.user.email ?? "—"} · {new Date(c.createdAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
      <form onSubmit={handleSubmit} className="card-header border-t border-white/25 px-6 py-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="input-base min-h-[80px]"
          placeholder="Add a comment…"
          rows={2}
        />
        <button type="submit" disabled={submitting || !body.trim()} className="btn-primary mt-3">
          {submitting ? "Sending…" : "Add comment"}
        </button>
      </form>
    </div>
  );
}
