-- Migration: allow multiple roles per user (users.role → users.roles array)
-- Run once on existing DBs: psql $DATABASE_URL -f sql/migrate-roles-array.sql
-- New installs use schema.sql which already has roles.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE users ADD COLUMN IF NOT EXISTS roles "UserRole"[];
    UPDATE users SET roles = ARRAY[role]::"UserRole"[] WHERE roles IS NULL AND role IS NOT NULL;
    UPDATE users SET roles = ARRAY['REQUESTER']::"UserRole"[] WHERE roles IS NULL;
    ALTER TABLE users ALTER COLUMN roles SET DEFAULT ARRAY['REQUESTER']::"UserRole"[];
    ALTER TABLE users ALTER COLUMN roles SET NOT NULL;
    ALTER TABLE users DROP COLUMN role;
  END IF;
END $$;
