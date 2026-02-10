-- Migration: allow multiple profiles per email (users.profile_name, unique email+profile_name)
-- Run once on existing DBs: npm run db:migrate-profiles (or psql $DATABASE_URL -f sql/migrate-profile-name.sql)

DO $$
BEGIN
  -- Add profile_name if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'profile_name'
  ) THEN
    ALTER TABLE users ADD COLUMN profile_name TEXT NOT NULL DEFAULT 'Default';
  END IF;
END $$;

-- Drop old UNIQUE on email if it exists, then add UNIQUE(email, profile_name)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_profile_name_key ON users (email, profile_name);
