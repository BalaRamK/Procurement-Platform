"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  user: { email: string | null; name: string | null };
};

type MentionUser = { id: string; name: string | null; email: string };

function formatCommentBody(body: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /@\[([^\]]*)\]\(([a-f0-9-]{36})\)/gi;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m.index > lastIndex) {
      parts.push(body.slice(lastIndex, m.index));
    }
    parts.push(
      <span key={m.index} className="font-medium text-primary-600 dark:text-primary-400">
        @{m[1] || "user"}
      </span>
    );
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < body.length) parts.push(body.slice(lastIndex));
  return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : <>{parts}</>;
}

export function TicketComments({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/requests/" + ticketId + "/comments")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setComments(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [ticketId]);

  useEffect(() => {
    fetch("/api/requests/" + ticketId + "/mention-users")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setMentionUsers(Array.isArray(data) ? data : []))
      .catch(() => setMentionUsers([]));
  }, [ticketId]);

  const filteredMentionUsers = mentionQuery.trim()
    ? mentionUsers.filter((u) => {
        const q = mentionQuery.toLowerCase();
        const name = (u.name ?? "").toLowerCase();
        const email = (u.email ?? "").toLowerCase();
        return name.includes(q) || email.includes(q);
      })
    : mentionUsers;
  const selectedUser = filteredMentionUsers[mentionIndex] ?? null;

  const insertMention = useCallback((user: MentionUser) => {
    const insert = `@[${user.name || user.email}](${user.id})`;
    const start = mentionStart;
    const queryLen = mentionQuery.length + 1;
    setBody((prev) => prev.slice(0, start) + insert + prev.slice(start + queryLen));
    setMentionOpen(false);
    setMentionQuery("");
    setMentionIndex(0);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [mentionStart, mentionQuery]);

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    const pos = e.target.selectionStart ?? v.length;
    setBody(v);

    const beforeCursor = v.slice(0, pos);
    const atIdx = beforeCursor.lastIndexOf("@");
    if (atIdx !== -1) {
      const afterAt = beforeCursor.slice(atIdx + 1);
      if (!/\s/.test(afterAt) && !afterAt.includes("](")) {
        setMentionQuery(afterAt);
        setMentionStart(atIdx);
        setMentionOpen(true);
        setMentionIndex(0);
        return;
      }
    }
    setMentionOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!mentionOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIndex((i) => Math.min(i + 1, filteredMentionUsers.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && selectedUser) {
      e.preventDefault();
      insertMention(selectedUser);
      return;
    }
    if (e.key === "Escape") {
      setMentionOpen(false);
    }
  }

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
      setMentionOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="card-header border-b px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Internal comments</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Approvals and clarifications. Type <kbd className="rounded border border-slate-300 bg-slate-100 px-1 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-800">@</kbd> to mention someone and notify them.
        </p>
      </div>
      <div className="divide-y divide-white/20 dark:divide-white/10">
        {loading ? (
          <div className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">Loading…</div>
        ) : comments.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">No comments yet.</div>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="px-6 py-4">
              <p className="text-sm text-slate-900 dark:text-slate-100">{formatCommentBody(c.body)}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {c.user.name ?? c.user.email ?? "—"} · {new Date(c.createdAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
      <form onSubmit={handleSubmit} className="card-header relative border-t border-white/25 px-6 py-4 dark:border-white/10">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={handleBodyChange}
          onKeyDown={handleKeyDown}
          className="input-base min-h-[80px]"
          placeholder="Add a comment… Type @ to mention someone"
          rows={2}
        />
        {mentionOpen && filteredMentionUsers.length > 0 && (
          <div className="absolute left-6 right-6 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
            {filteredMentionUsers.map((u, i) => (
              <button
                key={u.id}
                type="button"
                onClick={() => insertMention(u)}
                className={`block w-full px-4 py-2.5 text-left text-sm transition ${
                  i === mentionIndex
                    ? "bg-primary-100 text-primary-900 dark:bg-primary-900/40 dark:text-primary-100"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/50"
                }`}
              >
                <span className="font-medium">{u.name || u.email}</span>
                {u.name && <span className="ml-1.5 text-slate-500 dark:text-slate-400">{u.email}</span>}
              </button>
            ))}
          </div>
        )}
        <button type="submit" disabled={submitting || !body.trim()} className="btn-primary mt-3">
          {submitting ? "Sending…" : "Add comment"}
        </button>
      </form>
    </div>
  );
}
