-- Adds the DEPLOYMENT team to the TeamName enum.
-- Safe to run multiple times on PostgreSQL 12+.

ALTER TYPE "TeamName" ADD VALUE IF NOT EXISTS 'DEPLOYMENT';
