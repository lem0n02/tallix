-- Tallix Cloudflare D1 Database Schema Migration 0003
-- Forward migration to add avatar_url and monthly_budget to users table
-- Preserves all existing user records and production data

ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN monthly_budget REAL DEFAULT 25000;
