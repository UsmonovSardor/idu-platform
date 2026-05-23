-- 010: Per-chapter settings (random count, time window, allowed groups/year)
-- One row per (subject, chapter_num). When no row exists, defaults apply
-- (open to all, no time limit, no random shuffle).

CREATE TABLE IF NOT EXISTS chapter_settings (
  id              SERIAL       PRIMARY KEY,
  subject         VARCHAR(50)  NOT NULL,
  chapter_num     INTEGER      NOT NULL,
  -- How many questions to show the student (NULL = all). If less than chapter
  -- size, server shuffles and slices.
  random_count    INTEGER,
  -- Time window: chapter visible only between these timestamps.
  -- NULL on either side = open in that direction.
  available_from  TIMESTAMPTZ,
  available_to    TIMESTAMPTZ,
  -- Access restriction. NULL/empty = open to all.
  allowed_year    SMALLINT,            -- e.g. 1 = 1-kurs
  allowed_groups  TEXT[],              -- e.g. ARRAY['101','102','201A']
  created_by      INTEGER,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(subject, chapter_num)
);

CREATE INDEX IF NOT EXISTS idx_chapter_settings_subject
  ON chapter_settings (subject, chapter_num);

CREATE INDEX IF NOT EXISTS idx_chapter_settings_window
  ON chapter_settings (available_from, available_to);
