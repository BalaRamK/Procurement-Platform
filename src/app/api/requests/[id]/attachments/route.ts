import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { canViewTicket } from "@/lib/tickets";
import type { TeamName, TicketStatus, UserRole } from "@/types/db";
import { saveTicketAttachment } from "@/lib/attachments";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: ticketId } = await params;
  const ticket = await queryOne<{ requesterId: string; status: string; teamName: string }>(
    `SELECT requester_id AS "requesterId", status, team_name AS "teamName" FROM tickets WHERE id = $1`,
    [ticketId]
  );
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ticket.requesterId !== session.user.id) {
    return NextResponse.json({ error: "Only the requester can add attachments at request creation." }, { status: 403 });
  }

  const formData = await req.formData();
  const files = formData.getAll("files").filter((value): value is File => value instanceof File);
  if (files.length === 0) return NextResponse.json({ ok: true, attachments: [] });

  const attachments = [];
  for (const file of files) {
    const saved = await saveTicketAttachment(ticketId, file);
    const rows = await query<Record<string, unknown>>(
      `INSERT INTO ticket_attachments (ticket_id, original_name, stored_name, file_path, mime_type, size_bytes, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, original_name AS "originalName", mime_type AS "mimeType", size_bytes AS "sizeBytes", created_at AS "createdAt"`,
      [ticketId, file.name, saved.storedName, saved.filePath, file.type || null, saved.sizeBytes, session.user.id]
    );
    attachments.push(rows[0]);
  }

  return NextResponse.json({ ok: true, attachments });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: ticketId } = await params;
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

  const rows = await query(
    `SELECT id, original_name AS "originalName", mime_type AS "mimeType", size_bytes AS "sizeBytes", created_at AS "createdAt"
     FROM ticket_attachments WHERE ticket_id = $1 ORDER BY created_at ASC`,
    [ticketId]
  );
  return NextResponse.json(rows);
}
