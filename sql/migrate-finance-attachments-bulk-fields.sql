-- Adds Finance Approval role/status, bulk line-item metadata, and request attachments.
-- Safe to run multiple times on PostgreSQL 12+.

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'FINANCE_APPROVER' BEFORE 'CFO';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'PENDING_FINANCE_APPROVAL' BEFORE 'PENDING_CFO_APPROVAL';

ALTER TABLE ticket_line_items
  ADD COLUMN IF NOT EXISTS manufacturer TEXT,
  ADD COLUMN IF NOT EXISTS preferred_supplier TEXT,
  ADD COLUMN IF NOT EXISTS country_of_origin TEXT,
  ADD COLUMN IF NOT EXISTS extra_spares TEXT,
  ADD COLUMN IF NOT EXISTS remarks TEXT;

CREATE TABLE IF NOT EXISTS ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON ticket_attachments(ticket_id);
