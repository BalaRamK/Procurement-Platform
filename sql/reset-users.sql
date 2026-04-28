-- ============================================================
-- reset-users.sql
-- Wipes all users and related data, then seeds two super admins.
-- Usage: psql $DATABASE_URL -f sql/reset-users.sql
--
-- WARNING: This deletes ALL tickets, approval logs, comments,
-- notifications, and users. Run only on a dev/reset scenario.
-- ============================================================

-- 1. Remove all dependent data first (FK order matters)
DELETE FROM ticket_line_items;
DELETE FROM notifications;
DELETE FROM approval_logs;
DELETE FROM comments;
DELETE FROM tickets;
DELETE FROM users;

-- 2. Seed the two super admins
INSERT INTO users (email, profile_name, name, roles, status)
VALUES
  ('bala.k@qnulabs.com',       'Default', 'Bala',      ARRAY['SUPER_ADMIN']::"UserRole"[], true),
  ('prabhnoor.singh@qnulabs.com', 'Default', 'Prabhnoor', ARRAY['SUPER_ADMIN']::"UserRole"[], true);

-- Verify
SELECT email, profile_name, roles, status FROM users ORDER BY created_at;
