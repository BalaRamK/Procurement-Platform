import { randomUUID } from "crypto";
import { mkdir, stat, writeFile } from "fs/promises";
import { join } from "path";

export const ATTACHMENT_UPLOAD_ROOT =
  process.env.ATTACHMENT_UPLOAD_DIR || join(process.cwd(), "uploads", "request-attachments");

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ["image/"];
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "text/plain",
  "text/csv",
]);

export function isAllowedAttachment(file: File) {
  return ALLOWED_MIME_TYPES.has(file.type) || ALLOWED_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix));
}

export function validateAttachment(file: File) {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(`${file.name} is larger than 20 MB.`);
  }
  if (file.type && !isAllowedAttachment(file)) {
    throw new Error(`${file.name} is not an allowed attachment type.`);
  }
}

export function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 160) || "attachment";
}

export async function saveTicketAttachment(ticketId: string, file: File) {
  validateAttachment(file);
  const ticketDir = join(ATTACHMENT_UPLOAD_ROOT, ticketId);
  await mkdir(ticketDir, { recursive: true });
  const storedName = `${randomUUID()}-${sanitizeFilename(file.name)}`;
  const filePath = join(ticketDir, storedName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);
  return { storedName, filePath, sizeBytes: buffer.length };
}

export async function getAttachmentStorageUsage() {
  async function walk(dir: string): Promise<{ files: number; bytes: number }> {
    const fs = await import("fs/promises");
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return { files: 0, bytes: 0 };
    }
    let files = 0;
    let bytes = 0;
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        const child = await walk(full);
        files += child.files;
        bytes += child.bytes;
      } else if (entry.isFile()) {
        files++;
        bytes += (await stat(full)).size;
      }
    }
    return { files, bytes };
  }

  return walk(ATTACHMENT_UPLOAD_ROOT);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}
