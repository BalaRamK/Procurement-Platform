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
  canUpload,
}: {
  ticketId: string;
  attachments: Attachment[];
  canDelete: boolean;
  canUpload: boolean;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function uploadAttachments() {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("files", file));
      const res = await fetch(`/api/requests/${ticketId}/attachments`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Could not upload attachments.");
      }
      setSelectedFiles([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload attachments.");
    } finally {
      setUploading(false);
    }
  }

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
      {canUpload && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/40 p-4 dark:border-slate-700 dark:bg-white/5">
          <label className="block text-sm font-semibold text-slate-800 dark:text-slate-100" htmlFor={`attachment-upload-${ticketId}`}>
            Add supporting documents
          </label>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Upload quotes, approvals, specifications, images, spreadsheets, or other documents.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              id={`attachment-upload-${ticketId}`}
              name="attachments"
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif,.zip,.txt,.csv,image/*"
              onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))}
              className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-full file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-700 hover:file:bg-primary-100 dark:text-slate-200 dark:file:bg-white/10 dark:file:text-sky-100"
            />
            <button
              type="button"
              onClick={() => void uploadAttachments()}
              disabled={selectedFiles.length === 0 || uploading}
              className="btn btn-primary whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
          {selectedFiles.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
              {selectedFiles.map((file) => (
                <li key={`${file.name}-${file.size}`}>
                  {file.name} - {formatSize(file.size)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {attachments.length > 0 ? (
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
      ) : (
        <p className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          No attachments uploaded yet.
        </p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
