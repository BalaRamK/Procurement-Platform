-- Add read-only vertical owner role scoped by users.team.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'VERTICAL_OWNER' BEFORE 'FUNCTIONAL_HEAD';
