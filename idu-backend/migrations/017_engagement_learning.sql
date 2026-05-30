-- 017_engagement_learning.sql
-- Streak + daily challenge, spaced-repetition review queue, subject mastery (skill tree)

-- ── STREAKS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_streaks (
  user_id        INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active    DATE,
  freezes        INTEGER NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── DAILY CHALLENGE ───────────────────────────────────────────────────────────
-- One progress row per user per day. question_ids snapshot the day's set.
CREATE TABLE IF NOT EXISTS daily_challenge (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_date DATE NOT NULL,
  question_ids   JSONB NOT NULL DEFAULT '[]',
  answered       INTEGER NOT NULL DEFAULT 0,
  correct        INTEGER NOT NULL DEFAULT 0,
  total          INTEGER NOT NULL DEFAULT 5,
  completed      BOOLEAN NOT NULL DEFAULT FALSE,
  xp_earned      INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, challenge_date)
);
CREATE INDEX IF NOT EXISTS idx_daily_challenge_user ON daily_challenge(user_id, challenge_date DESC);

-- ── SPACED REPETITION REVIEW QUEUE ───────────────────────────────────────────
-- Wrong answers enter the queue; resurface at increasing intervals (1/3/7/16 days).
CREATE TABLE IF NOT EXISTS review_queue (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  subject     VARCHAR(20),
  stage       INTEGER NOT NULL DEFAULT 0,      -- 0..4 -> interval index
  due_at      DATE NOT NULL DEFAULT CURRENT_DATE,
  last_result VARCHAR(10),                      -- 'right' | 'wrong'
  reps        INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_review_queue_due ON review_queue(user_id, due_at);

-- ── SUBJECT MASTERY (skill tree) ──────────────────────────────────────────────
-- Aggregated per user per subject. mastery 0..100 drives the bilim-daraxti UI.
CREATE TABLE IF NOT EXISTS subject_mastery (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject     VARCHAR(20) NOT NULL,
  correct     INTEGER NOT NULL DEFAULT 0,
  total       INTEGER NOT NULL DEFAULT 0,
  mastery     INTEGER NOT NULL DEFAULT 0,       -- 0..100
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, subject)
);
