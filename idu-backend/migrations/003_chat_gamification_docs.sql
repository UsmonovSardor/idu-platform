-- 003_chat_gamification_docs.sql

-- ── CHAT ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_rooms (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  type        VARCHAR(20)  NOT NULL DEFAULT 'group', -- 'group' | 'direct' | 'announce'
  created_by  INTEGER REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_room_members (
  room_id    INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         SERIAL PRIMARY KEY,
  room_id    INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id, created_at DESC);

-- ── GAMIFICATION ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_xp (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp         INTEGER NOT NULL DEFAULT 0,
  level      INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_badges (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_code VARCHAR(50) NOT NULL,
  earned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, badge_code)
);

CREATE TABLE IF NOT EXISTS xp_log (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     INTEGER NOT NULL,
  reason     VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_xp_xp       ON user_xp(xp DESC);
CREATE INDEX IF NOT EXISTS idx_user_badges_user  ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_log_user       ON xp_log(user_id, created_at DESC);
