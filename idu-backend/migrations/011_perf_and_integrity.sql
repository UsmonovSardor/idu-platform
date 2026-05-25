-- 011_perf_and_integrity.sql
-- Performance indexes + data integrity improvements

-- ── exam_attempts: composite index for common query patterns ─────────────────
-- GET /exams/history filters by (student_id, exam_type) frequently
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_type
  ON exam_attempts(student_id, exam_type);

-- GET /exams/active: teacher_exams is_active lookup
CREATE INDEX IF NOT EXISTS idx_teacher_exams_active
  ON teacher_exams(is_active) WHERE is_active = TRUE;

-- ── submissions: index for teacher-facing listing (most common query) ────────
CREATE INDEX IF NOT EXISTS idx_submissions_assignment
  ON submissions(assignment_id, submitted_at DESC);

-- ── audit_log: time-range queries for rector dashboard ───────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_log_created
  ON audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_user
  ON audit_log(user_id, created_at DESC);

-- ── failed_logins: prune entries older than 24 hours (keep table lean) ───────
DELETE FROM failed_logins
  WHERE created_at < NOW() - INTERVAL '24 hours';

-- ── grades: index for group-level reporting (rector group-stats query) ────────
CREATE INDEX IF NOT EXISTS idx_grades_student
  ON grades(student_id);

-- ── attendance: index for rate calculation queries ────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attendance_records_student
  ON attendance_records(student_id);

-- ── Legacy manual attendance table (was lazily created in students.js) ────────
CREATE TABLE IF NOT EXISTS attendance (
  id           SERIAL PRIMARY KEY,
  student_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teacher_id   INTEGER NOT NULL REFERENCES users(id),
  date         DATE NOT NULL,
  present      BOOLEAN NOT NULL DEFAULT TRUE,
  excused      BOOLEAN NOT NULL DEFAULT FALSE,
  note         TEXT,
  group_name   VARCHAR(50),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_student_date
  ON attendance(student_id, date DESC);

-- ── questions: ensure chapter_num exists (migration 008 guard) ───────────────
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS chapter_num INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_questions_subject_chapter
  ON questions(subject, chapter_num) WHERE is_active = TRUE;
