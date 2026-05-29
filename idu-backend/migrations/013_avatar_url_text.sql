-- Migration 013: Change avatar_url column from VARCHAR(500) to TEXT
-- Required for storing base64-encoded compressed images (~40KB–450KB)
ALTER TABLE users ALTER COLUMN avatar_url TYPE TEXT;
