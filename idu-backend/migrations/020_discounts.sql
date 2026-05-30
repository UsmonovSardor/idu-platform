-- 020_discounts.sql — tuition discount ledger granted via IDU Liga rewards.
-- A discount reward is only written here AFTER dekanat approves the proposal,
-- one row per student in the winning group. This is an entitlement record;
-- the actual billing system stays manual/external (no money moves automatically).

CREATE TABLE IF NOT EXISTS student_discounts (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
  group_name    VARCHAR(100),
  percent       NUMERIC(6,2) NOT NULL,
  reason        TEXT,
  source        VARCHAR(40) NOT NULL DEFAULT 'liga',
  tournament_id INTEGER REFERENCES comp_tournaments(id) ON DELETE SET NULL,
  reward_id     INTEGER REFERENCES comp_rewards(id) ON DELETE SET NULL,
  granted_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discounts_user  ON student_discounts(user_id);
CREATE INDEX IF NOT EXISTS idx_discounts_group ON student_discounts(group_name);
CREATE INDEX IF NOT EXISTS idx_discounts_reward ON student_discounts(reward_id);
