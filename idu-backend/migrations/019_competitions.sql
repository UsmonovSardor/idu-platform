-- 019_competitions.sql — "IDU Liga" inter-group subject tournaments
-- Teams = academic groups. Dekanat organises a per-subject knockout bracket
-- each semester. Matches are live quiz battles (Phase 2). Winners earn a
-- trophy + an optional real tuition discount that dekanat must approve (Phase 3).

-- ── Tournaments ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comp_tournaments (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(160) NOT NULL,
  subject      VARCHAR(40)  NOT NULL,                 -- algo|ai|math|db|web|...
  semester     VARCHAR(20)  NOT NULL,                 -- e.g. 2025-2026-2
  format       VARCHAR(20)  NOT NULL DEFAULT 'knockout',
  status       VARCHAR(20)  NOT NULL DEFAULT 'draft', -- draft|active|completed
  total_rounds INTEGER      NOT NULL DEFAULT 1,
  bracket_size INTEGER      NOT NULL DEFAULT 2,
  questions_per_match INTEGER NOT NULL DEFAULT 10,
  seconds_per_question INTEGER NOT NULL DEFAULT 20,
  champion_team_id INTEGER,                           -- set on completion
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  starts_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Teams (a group enrolled into one tournament) ─────────────────────────────
CREATE TABLE IF NOT EXISTS comp_teams (
  id              SERIAL PRIMARY KEY,
  tournament_id   INTEGER NOT NULL REFERENCES comp_tournaments(id) ON DELETE CASCADE,
  group_name      VARCHAR(100) NOT NULL,
  faculty         VARCHAR(120),
  seed            INTEGER,
  rating          INTEGER NOT NULL DEFAULT 1000,
  played          INTEGER NOT NULL DEFAULT 0,
  wins            INTEGER NOT NULL DEFAULT 0,
  losses          INTEGER NOT NULL DEFAULT 0,
  points          INTEGER NOT NULL DEFAULT 0,
  captain_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  eliminated      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id, group_name)
);

-- ── Matches (one bracket slot) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comp_matches (
  id            SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES comp_tournaments(id) ON DELETE CASCADE,
  round         INTEGER NOT NULL,                       -- 1 = first round, total_rounds = final
  slot          INTEGER NOT NULL,                       -- position within the round (0-based)
  team_a_id     INTEGER REFERENCES comp_teams(id) ON DELETE SET NULL,
  team_b_id     INTEGER REFERENCES comp_teams(id) ON DELETE SET NULL,
  winner_team_id INTEGER REFERENCES comp_teams(id) ON DELETE SET NULL,
  team_a_score  NUMERIC(6,2) NOT NULL DEFAULT 0,        -- normalised % (fair across team sizes)
  team_b_score  NUMERIC(6,2) NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|ready|live|finished
  scheduled_at  TIMESTAMPTZ,
  question_ids  JSONB,
  next_match_id INTEGER REFERENCES comp_matches(id) ON DELETE SET NULL,
  next_slot     CHAR(1),                                -- 'a' | 'b' : which side the winner fills
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Live-match participants (students who joined a battle) ────────────────────
CREATE TABLE IF NOT EXISTS comp_match_participants (
  id        SERIAL PRIMARY KEY,
  match_id  INTEGER NOT NULL REFERENCES comp_matches(id) ON DELETE CASCADE,
  team_id   INTEGER NOT NULL REFERENCES comp_teams(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  correct   INTEGER NOT NULL DEFAULT 0,
  answered  INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, user_id)
);

-- ── Per-question answers (audit + anti-cheat + live scoring) ──────────────────
CREATE TABLE IF NOT EXISTS comp_answers (
  id          SERIAL PRIMARY KEY,
  match_id    INTEGER NOT NULL REFERENCES comp_matches(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id     INTEGER NOT NULL REFERENCES comp_teams(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL,
  q_index     INTEGER NOT NULL,
  choice      CHAR(1),
  is_correct  BOOLEAN NOT NULL DEFAULT FALSE,
  answer_ms   INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, user_id, q_index)
);

-- ── Rewards (trophy / discount) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comp_rewards (
  id            SERIAL PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES comp_tournaments(id) ON DELETE CASCADE,
  team_id       INTEGER NOT NULL REFERENCES comp_teams(id) ON DELETE CASCADE,
  type          VARCHAR(20) NOT NULL,                    -- trophy|discount
  value         NUMERIC(6,2),                            -- discount %, null for trophy
  placement     INTEGER,                                 -- 1=champion, 2=runner-up
  status        VARCHAR(20) NOT NULL DEFAULT 'proposed', -- proposed|approved|rejected
  note          TEXT,
  approved_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_comp_teams_tour   ON comp_teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_comp_matches_tour ON comp_matches(tournament_id, round, slot);
CREATE INDEX IF NOT EXISTS idx_comp_matches_stat ON comp_matches(status);
CREATE INDEX IF NOT EXISTS idx_comp_parts_match  ON comp_match_participants(match_id);
CREATE INDEX IF NOT EXISTS idx_comp_answers_match ON comp_answers(match_id);
CREATE INDEX IF NOT EXISTS idx_comp_rewards_tour ON comp_rewards(tournament_id, status);
