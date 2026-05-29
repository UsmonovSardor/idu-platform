-- Migration 016: Add DEFAULT to user_code so new INSERTs get auto-generated code
-- This fixes INSERT failures when user_code is not explicitly provided

-- Add a default expression: 16-digit numeric string, first digit 1-9
ALTER TABLE users
  ALTER COLUMN user_code
  SET DEFAULT lpad(
    (floor(random() * 9000000000000000) + 1000000000000000)::BIGINT::TEXT,
    16, '0'
  );
