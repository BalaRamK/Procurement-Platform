-- Migration: add project_customer_options and charge_code_options for New request dropdowns
-- Run once on existing DBs: npm run db:migrate-request-options (loads DATABASE_URL from .env)

CREATE TABLE IF NOT EXISTS project_customer_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS charge_code_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  team_name "TeamName" NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(code, team_name)
);

CREATE INDEX IF NOT EXISTS idx_charge_code_options_team ON charge_code_options(team_name);
