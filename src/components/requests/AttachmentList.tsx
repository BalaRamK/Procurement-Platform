"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Attachment = {
  id: string;
  originalName: string;
  sizeBytes: number;
};

function formatSize(size: number) {
  return size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(2)} MB` : `${(size / 1024).toFixed(1)} KB`;
}

export function AttachmentList({
  ticketId,
  attachments,
  canDelete,
}: {
  ticketId: string;
  attachments: Attachment[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function deleteAttachment(attachmentId: string) {
    setDeletingId(attachmentId);
    setError("");
    try {
      const res = await fetch(`/api/requests/${ticketId}/attachments/${attachmentId}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Could not delete attachment.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete attachment.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
        {attachments.map((attachment) => (
          <li key={attachment.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">{attachment.originalName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{formatSize(attachment.sizeBytes)}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a href={`/api/requests/${ticketId}/attachments/${attachment.id}`} className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-sky-200 dark:hover:text-white">
                Download
              </a>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => void deleteAttachment(attachment.id)}
                  disabled={deletingId === attachment.id}
                  className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-300 dark:hover:text-red-200"
                >
                  {deletingId === attachment.id ? "Deleting..." : "Delete"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
