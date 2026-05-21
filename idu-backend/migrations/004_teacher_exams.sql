-- 004_teacher_exams.sql
-- Teacher-created exams (oraliq, joriy nazorat, free practice)

CREATE TABLE IF NOT EXISTS teacher_exams (
  id              SERIAL PRIMARY KEY,
  teacher_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(200) NOT NULL,
  description     TEXT,
  subject         VARCHAR(100) NOT NULL,
  group_name      VARCHAR(50)  NOT NULL,
  exam_type       VARCHAR(20)  NOT NULL DEFAULT 'practice',
    -- 'oraliq' | 'joriy' | 'yakuniy' | 'practice'
  duration_min    INTEGER      NOT NULL DEFAULT 30,
  total_score     INTEGER      NOT NULL DEFAULT 100,
  shuffle_q       BOOLEAN      NOT NULL DEFAULT TRUE,
  shuffle_opts    BOOLEAN      NOT NULL DEFAULT TRUE,
  show_results    BOOLEAN      NOT NULL DEFAULT TRUE,
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teacher_exam_questions (
  id              SERIAL PRIMARY KEY,
  exam_id         INTEGER NOT NULL REFERENCES teacher_exams(id) ON DELETE CASCADE,
  question_text   TEXT NOT NULL,
  option_a        TEXT NOT NULL,
  option_b        TEXT NOT NULL,
  option_c        TEXT,
  option_d        TEXT,
  correct_option  CHAR(1) NOT NULL CHECK (correct_option IN ('A','B','C','D')),
  explanation     TEXT,
  position        INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teacher_exam_attempts (
  id              SERIAL PRIMARY KEY,
  exam_id         INTEGER NOT NULL REFERENCES teacher_exams(id) ON DELETE CASCADE,
  student_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers         JSONB DEFAULT '{}'::jsonb,
  score           NUMERIC(5,2),
  correct_count   INTEGER DEFAULT 0,
  total_count     INTEGER DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    -- 'in_progress' | 'submitted' | 'auto_submitted' | 'cheated'
  cheat_warnings  INTEGER DEFAULT 0,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at    TIMESTAMPTZ,
  UNIQUE (exam_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_exams_teacher  ON teacher_exams(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_exams_group    ON teacher_exams(group_name, is_active);
CREATE INDEX IF NOT EXISTS idx_teacher_exam_q_exam    ON teacher_exam_questions(exam_id, position);
CREATE INDEX IF NOT EXISTS idx_teacher_exam_a_exam    ON teacher_exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_teacher_exam_a_student ON teacher_exam_attempts(student_id);
