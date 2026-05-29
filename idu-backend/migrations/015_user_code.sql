-- Migration 015: Add unique 16-digit user_code to every user
-- Generated once at registration (or on first run for existing users)

ALTER TABLE users ADD COLUMN IF NOT EXISTS user_code CHAR(16) UNIQUE;

-- Fill existing users with random unique 16-digit codes
DO $$
DECLARE
  rec RECORD;
  code CHAR(16);
  attempts INT;
BEGIN
  FOR rec IN SELECT id FROM users WHERE user_code IS NULL LOOP
    attempts := 0;
    LOOP
      -- Generate 16-digit code: first digit 1-9, rest 0-9
      code := (floor(random()*9)+1)::TEXT ||
              lpad(floor(random()*1000000000000000)::BIGINT::TEXT, 15, '0');
      code := left(code, 16);
      BEGIN
        UPDATE users SET user_code = code WHERE id = rec.id;
        EXIT; -- success, no conflict
      EXCEPTION WHEN unique_violation THEN
        attempts := attempts + 1;
        IF attempts > 100 THEN RAISE EXCEPTION 'Could not generate unique code'; END IF;
      END;
    END LOOP;
  END LOOP;
END;
$$;

-- Now make it NOT NULL
ALTER TABLE users ALTER COLUMN user_code SET NOT NULL;

-- Fast lookup index
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_code ON users (user_code);
