-- Procurement Platform — PostgreSQL schema (matches former Prisma schema)
-- Run: npm run db:init (or psql $DATABASE_URL -f sql/schema.sql)

-- Enums (idempotent: skip if exists)
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'REQUESTER', 'FUNCTIONAL_HEAD', 'L1_APPROVER', 'CFO', 'CDO', 'PRODUCTION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "TeamName" AS ENUM ('INNOVATION', 'ENGINEERING', 'SALES');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "TicketStatus" AS ENUM ('DRAFT', 'PENDING_FH_APPROVAL', 'PENDING_L1_APPROVAL', 'PENDING_CFO_APPROVAL', 'PENDING_CDO_APPROVAL', 'ASSIGNED_TO_PRODUCTION', 'DELIVERED_TO_REQUESTER', 'CONFIRMED_BY_REQUESTER', 'CLOSED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CostCurrency" AS ENUM ('USD', 'INR', 'EUR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  azure_id TEXT,
  role "UserRole" NOT NULL DEFAULT 'REQUESTER',
  team "TeamName",
  status BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tickets
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  requester_name TEXT NOT NULL,
  department TEXT NOT NULL,
  component_description TEXT,
  item_name TEXT,
  bom_id TEXT,
  product_id TEXT,
  project_customer TEXT,
  need_by_date DATE,
  charge_code TEXT,
  cost_currency "CostCurrency",
  estimated_cost DECIMAL(12,2),
  rate DECIMAL(12,2),
  unit TEXT,
  estimated_po_date DATE,
  place_of_delivery TEXT,
  quantity INT,
  deal_name TEXT,
  team_name "TeamName" NOT NULL,
  priority "Priority" NOT NULL DEFAULT 'MEDIUM',
  status "TicketStatus" NOT NULL DEFAULT 'DRAFT',
  rejection_remarks TEXT,
  requester_id UUID NOT NULL REFERENCES users(id),
  delivered_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  auto_closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_requester_id ON tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_request_id ON tickets(request_id);

-- Approval logs
CREATE TABLE IF NOT EXISTS approval_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_logs_ticket_id ON approval_logs(ticket_id);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_ticket_id ON comments(ticket_id);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient);

-- Email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger TEXT NOT NULL,
  subject_template VARCHAR(500) NOT NULL,
  body_template TEXT NOT NULL,
  timeline TEXT NOT NULL DEFAULT 'immediate',
  delay_minutes INT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to keep updated_at in sync (optional)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
DROP TRIGGER IF EXISTS tickets_updated_at ON tickets;
CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
DROP TRIGGER IF EXISTS email_templates_updated_at ON email_templates;
CREATE TRIGGER email_templates_updated_at BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
