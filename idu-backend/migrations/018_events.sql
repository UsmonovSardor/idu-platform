-- 018_events.sql — calendar events (personal + dekanat/teacher broadcast)

CREATE TABLE IF NOT EXISTS events (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(150) NOT NULL,
  description TEXT,
  event_date  DATE NOT NULL,
  start_time  TIME,
  type        VARCHAR(20) NOT NULL DEFAULT 'event',  -- event|party|meeting|holiday|deadline|personal
  color       VARCHAR(16) NOT NULL DEFAULT '#2563eb',
  scope       VARCHAR(20) NOT NULL DEFAULT 'personal', -- personal|all|faculty|group
  scope_value VARCHAR(100),                            -- faculty/group name when scoped
  created_by  INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_date  ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_scope ON events(scope, scope_value);
CREATE INDEX IF NOT EXISTS idx_events_owner ON events(created_by);
