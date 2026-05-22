-- 005_audit_security.sql
-- Audit log + failed login tracking + password policy

CREATE TABLE IF NOT EXISTS audit_log (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_login   VARCHAR(100),
  user_role    VARCHAR(20),
  action       VARCHAR(50)  NOT NULL,
    -- e.g. 'LOGIN','LOGOUT','LOGIN_FAILED','CREATE_USER','DELETE_USER',
    -- 'CREATE_GRADE','UPDATE_GRADE','DELETE_GRADE','UPLOAD_QUESTIONS',
    -- 'CREATE_EXAM','SUBMIT_EXAM','CHEAT_DETECTED','OPEN_ATTENDANCE',
    -- 'MARK_ATTENDANCE','DOWNLOAD_TRANSCRIPT'
  entity       VARCHAR(50),   -- e.g. 'user','grade','exam','attendance'
  entity_id    INTEGER,
  ip_address   VARCHAR(45),
  user_agent   TEXT,
  details      JSONB DEFAULT '{}'::jsonb,
  status       VARCHAR(20) NOT NULL DEFAULT 'success', -- 'success'|'failed'|'blocked'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user      ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action    ON audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created   ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_status    ON audit_log(status) WHERE status != 'success';

-- Failed login attempt tracking (for lockout)
CREATE TABLE IF NOT EXISTS failed_logins (
  id           SERIAL PRIMARY KEY,
  login        VARCHAR(100) NOT NULL,
  ip_address   VARCHAR(45),
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_failed_logins_login_time
  ON failed_logins(login, attempted_at DESC);

-- Account lockouts (active locks)
CREATE TABLE IF NOT EXISTS account_lockouts (
  login        VARCHAR(100) PRIMARY KEY,
  locked_until TIMESTAMPTZ NOT NULL,
  reason       VARCHAR(100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add password_changed_at column to users for password expiry policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='users' AND column_name='password_changed_at'
  ) THEN
    ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Track failed login count for soft warnings
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='users' AND column_name='failed_login_count'
  ) THEN
    ALTER TABLE users ADD COLUMN failed_login_count INTEGER DEFAULT 0;
  END IF;
END $$;
