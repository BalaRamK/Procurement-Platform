-- Adds alternate-quote loop-back tracking for the Finance Approval stage.
-- Safe to run multiple times on PostgreSQL 12+.

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS alternate_quote_state TEXT,
  ADD COLUMN IF NOT EXISTS alternate_quote_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS alternate_quote_requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS alternate_quote_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS alternate_quote_submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS alternate_quote_remarks TEXT;

DO $$ BEGIN
  ALTER TABLE tickets
    ADD CONSTRAINT tickets_alternate_quote_state_check
    CHECK (alternate_quote_state IN ('REQUESTED', 'SUBMITTED'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
