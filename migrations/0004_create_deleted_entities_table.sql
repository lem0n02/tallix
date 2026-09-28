-- Tallix Cloudflare D1 Database Schema Migration 0004
-- Tombstone tracking for hard-deleted entities (users, groups, etc.)
-- Enables sync pull across devices without keeping personal or sensitive user data

CREATE TABLE IF NOT EXISTS deleted_entities (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  deleted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_deleted_entities_type_time ON deleted_entities(entity_type, deleted_at);
