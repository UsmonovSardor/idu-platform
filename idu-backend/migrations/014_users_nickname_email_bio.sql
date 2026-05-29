-- Migration 014: Add nickname, email, bio columns to users table
-- nickname is unique (case-insensitive), used for user search
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS nickname  VARCHAR(30)  UNIQUE,
  ADD COLUMN IF NOT EXISTS email     VARCHAR(150) UNIQUE,
  ADD COLUMN IF NOT EXISTS bio       TEXT;

-- Case-insensitive index for fast nickname lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_nickname_lower ON users (LOWER(nickname)) WHERE nickname IS NOT NULL;
CREATE INDEX        IF NOT EXISTS idx_users_email          ON users (LOWER(email))    WHERE email IS NOT NULL;
