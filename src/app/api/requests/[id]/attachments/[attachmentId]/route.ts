import { readFile, rm } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { canViewTicket } from "@/lib/tickets";
import type { TeamName, TicketStatus, UserRole } from "@/types/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: ticketId, attachmentId } = await params;
  const ticket = await queryOne<{ requesterId: string; status: string; teamName: string }>(
    `SELECT requester_id AS "requesterId", status, team_name AS "teamName" FROM tickets WHERE id = $1`,
    [ticketId]
  );
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const roles = session.user.roles ?? [];
  const authorized =
    ticket.requesterId === session.user.id ||
    canViewTicket(
      roles as UserRole[],
      session.user.team as TeamName | null,
      ticket as { requesterId: string; status: TicketStatus; teamName: TeamName }
    );
  if (!authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const attachment = await queryOne<{
    originalName: string;
    filePath: string;
    mimeType: string | null;
    sizeBytes: string | number;
  }>(
    `SELECT original_name AS "originalName", file_path AS "filePath", mime_type AS "mimeType", size_bytes AS "sizeBytes"
     FROM ticket_attachments WHERE id = $1 AND ticket_id = $2`,
    [attachmentId, ticketId]
  );
  if (!attachment) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

  const file = await readFile(attachment.filePath);
  return new NextResponse(file, {
    headers: {
      "Content-Type": attachment.mimeType || "application/octet-stream",
      "Content-Length": String(attachment.sizeBytes),
      "Content-Disposition": `attachment; filename="${attachment.originalName.replace(/"/g, "")}"`,
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: ticketId, attachmentId } = await params;
  const ticket = await queryOne<{ requesterId: string; status: string }>(
    `SELECT requester_id AS "requesterId", status FROM tickets WHERE id = $1`,
    [ticketId]
  );
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ticket.requesterId !== session.user.id || ticket.status !== "DRAFT") {
    return NextResponse.json({ error: "Only the requester can delete draft attachments." }, { status: 403 });
  }

  const attachment = await queryOne<{ filePath: string }>(
    `SELECT file_path AS "filePath" FROM ticket_attachments WHERE id = $1 AND ticket_id = $2`,
    [attachmentId, ticketId]
  );
  if (!attachment) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

  await query("DELETE FROM ticket_attachments WHERE id = $1 AND ticket_id = $2", [attachmentId, ticketId]);
  await rm(attachment.filePath, { force: true }).catch((error) => {
    console.warn("[attachment delete] file removal failed", error);
  });
  return NextResponse.json({ ok: true });
}
