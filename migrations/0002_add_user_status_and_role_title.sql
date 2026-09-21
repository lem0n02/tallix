-- Tallix Cloudflare D1 Database Schema Migration 0002
-- Forward migration to add status and role_title to users table
-- Preserves all existing user records and production data

ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'Active';
ALTER TABLE users ADD COLUMN role_title TEXT;
