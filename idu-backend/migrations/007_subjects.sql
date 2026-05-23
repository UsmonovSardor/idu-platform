-- 007_subjects.sql — Dynamic subjects management
-- Allows dekanat/admin to add, edit, delete subjects without code changes.

CREATE TABLE IF NOT EXISTS subjects (
  id         SERIAL PRIMARY KEY,
  code       VARCHAR(50)  NOT NULL UNIQUE,  -- 'algo', 'math', etc.
  label      VARCHAR(100) NOT NULL,          -- 'Algoritmlar va Dasturlash'
  icon       VARCHAR(10)  NOT NULL DEFAULT '📚',
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order INTEGER      NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Pre-populate with existing hardcoded subjects
INSERT INTO subjects (code, label, icon, sort_order) VALUES
  ('algo', 'Algoritmlar va Dasturlash', '💻', 1),
  ('ai',   'Sun''iy Intellekt',          '🤖', 2),
  ('math', 'Matematika (AI uchun)',      '📐', 3),
  ('db',   'Ma''lumotlar Bazasi',        '🗄️', 4),
  ('web',  'Web Texnologiya',            '🌐', 5)
ON CONFLICT (code) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_subjects_active ON subjects (is_active, sort_order);
