-- Migration 012: Push Notifications + Forum Q&A
-- Created: 2026-05-28

-- ── Push subscriptions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint    TEXT NOT NULL,
    p256dh      TEXT NOT NULL,
    auth        TEXT NOT NULL,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used   TIMESTAMPTZ,
    UNIQUE(user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions (user_id);

-- ── Forum Questions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forum_questions (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    body        TEXT NOT NULL,
    category    VARCHAR(50) DEFAULT 'umumiy',
    views       INT NOT NULL DEFAULT 0,
    upvotes     INT NOT NULL DEFAULT 0,
    is_solved   BOOLEAN NOT NULL DEFAULT FALSE,
    accepted_answer_id INT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_forum_q_user      ON forum_questions (user_id);
CREATE INDEX IF NOT EXISTS idx_forum_q_category  ON forum_questions (category);
CREATE INDEX IF NOT EXISTS idx_forum_q_created   ON forum_questions (created_at DESC);

-- ── Forum Answers ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forum_answers (
    id          SERIAL PRIMARY KEY,
    question_id INT NOT NULL REFERENCES forum_questions(id) ON DELETE CASCADE,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    upvotes     INT NOT NULL DEFAULT 0,
    is_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_forum_a_question ON forum_answers (question_id);
CREATE INDEX IF NOT EXISTS idx_forum_a_user     ON forum_answers (user_id);

-- ── Forum Votes (prevent duplicate voting) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS forum_votes (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('question','answer')),
    target_id   INT NOT NULL,
    value       SMALLINT NOT NULL CHECK (value IN (-1, 1)),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, target_type, target_id)
);

-- ── User profile extension ────────────────────────────────────────────────────
-- Add bio + email columns if they don't exist (safe add)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='users' AND column_name='bio') THEN
        ALTER TABLE users ADD COLUMN bio VARCHAR(500);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='users' AND column_name='email') THEN
        ALTER TABLE users ADD COLUMN email VARCHAR(150);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
    END IF;
END $$;
