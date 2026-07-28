-- Adds ticket-level Engineering L1 routing, rejection attribution, and urgent reminder scheduling.
-- Safe to run multiple times on PostgreSQL 12+.

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS l1_manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_by_name TEXT,
  ADD COLUMN IF NOT EXISTS rejected_by_email TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_stage TEXT,
  ADD COLUMN IF NOT EXISTS urgent_reminder_due_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tickets_l1_manager_id ON tickets(l1_manager_id);
CREATE INDEX IF NOT EXISTS idx_tickets_urgent_reminder_due
  ON tickets(urgent_reminder_due_at)
  WHERE priority = 'URGENT' AND urgent_reminder_due_at IS NOT NULL;
