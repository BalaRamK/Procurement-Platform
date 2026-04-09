ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS brand_name_company TEXT,
  ADD COLUMN IF NOT EXISTS preferred_supplier TEXT,
  ADD COLUMN IF NOT EXISTS country_of_origin TEXT;
