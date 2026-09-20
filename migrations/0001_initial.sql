-- Tallix Cloudflare D1 Database Schema Migration 0001
-- Offline-First Idempotent Storage Architecture

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  system_role TEXT DEFAULT 'User',
  role TEXT,
  title TEXT,
  department TEXT,
  avatar_gradient TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Squads / Groups Table
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'General',
  currency TEXT DEFAULT 'BDT',
  invite_code TEXT UNIQUE,
  image_url TEXT,
  created_by TEXT,
  members_json TEXT NOT NULL, -- JSON array of GroupMember objects
  total_spent REAL DEFAULT 0,
  unsettled_amount REAL DEFAULT 0,
  version INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_groups_invite_code ON groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_groups_updated_at ON groups(updated_at);
CREATE INDEX IF NOT EXISTS idx_groups_deleted_at ON groups(deleted_at);

-- 3. Expenses / Transactions Table
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  group_id TEXT,
  group_name TEXT,
  is_shared INTEGER DEFAULT 0,
  title TEXT NOT NULL,
  merchant TEXT,
  amount REAL NOT NULL,
  amount_paisa INTEGER NOT NULL, -- Integer minor units avoiding floating point drift
  currency TEXT DEFAULT 'BDT',
  category TEXT DEFAULT 'General',
  payment_method TEXT DEFAULT 'Cash',
  date TEXT NOT NULL,
  status TEXT DEFAULT 'Completed',
  paid_by_user_id TEXT NOT NULL,
  paid_by_name TEXT,
  created_by TEXT,
  created_by_email TEXT,
  splits_json TEXT, -- JSON array of SplitShare objects
  receipt_url TEXT,
  notes TEXT,
  version INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_expenses_group_id ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses(paid_by_user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_updated_at ON expenses(updated_at);
CREATE INDEX IF NOT EXISTS idx_expenses_deleted_at ON expenses(deleted_at);

-- 4. Settlements Table
CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  group_id TEXT,
  group_name TEXT,
  from_user_id TEXT NOT NULL,
  from_user_name TEXT,
  to_user_id TEXT NOT NULL,
  to_user_name TEXT,
  amount REAL NOT NULL,
  amount_paisa INTEGER NOT NULL,
  currency TEXT DEFAULT 'BDT',
  payment_method TEXT DEFAULT 'bKash',
  status TEXT DEFAULT 'Pending',
  proof_url TEXT,
  note TEXT,
  version INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_settlements_group_id ON settlements(group_id);
CREATE INDEX IF NOT EXISTS idx_settlements_from_user ON settlements(from_user_id);
CREATE INDEX IF NOT EXISTS idx_settlements_to_user ON settlements(to_user_id);
CREATE INDEX IF NOT EXISTS idx_settlements_updated_at ON settlements(updated_at);
CREATE INDEX IF NOT EXISTS idx_settlements_deleted_at ON settlements(deleted_at);

-- 5. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  source TEXT,
  timestamp TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

-- 6. Guest Visits Table
CREATE TABLE IF NOT EXISTS guest_visits (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  ip TEXT,
  country TEXT,
  city TEXT,
  user_agent TEXT,
  visited_at TEXT NOT NULL
);

-- 7. Idempotency Tracking: Processed Mutations Table
-- Guarantees that even if client retries or re-sends a mutation, it is executed exactly once
CREATE TABLE IF NOT EXISTS processed_mutations (
  mutation_id TEXT PRIMARY KEY,
  client_device_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  processed_at TEXT NOT NULL,
  result_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_processed_mutations_entity ON processed_mutations(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_processed_mutations_time ON processed_mutations(processed_at);
