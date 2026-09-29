-- Tallix Cloudflare D1 Database Schema Migration 0005
-- Forward migration to add google_id and auth_provider to users table
-- Preserves all existing user records, passwords, and permissions
ALTER TABLE users ADD COLUMN google_id TEXT;
ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'local';
