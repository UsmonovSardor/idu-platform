-- =============================================================================
-- 025_soft_deletes.sql
-- Soft-delete pattern for critical tables.
-- Adds deleted_at + partial indexes so existing queries stay fast.
-- FERPA/GDPR compliance: data is never permanently removed, just hidden.
-- =============================================================================

-- Grades
ALTER TABLE grades ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_grades_not_deleted ON grades(student_id) WHERE deleted_at IS NULL;

-- Courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_courses_not_deleted ON courses(tenant_id) WHERE deleted_at IS NULL;

-- Assignments
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_assignments_not_deleted ON assignments(deadline) WHERE deleted_at IS NULL;

-- Exam attempts (individual exam sessions)
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_exam_attempts_not_deleted ON exam_attempts(student_id) WHERE deleted_at IS NULL;

-- Forum questions
ALTER TABLE forum_questions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_forum_questions_not_deleted ON forum_questions(created_at DESC) WHERE deleted_at IS NULL;

-- Chat messages (soft-delete for moderation)
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Audit: log soft-delete events
CREATE TABLE IF NOT EXISTS deletion_log (
  id          BIGSERIAL PRIMARY KEY,
  table_name  TEXT        NOT NULL,
  record_id   BIGINT      NOT NULL,
  deleted_by  INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  reason      TEXT,
  deleted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deletion_log_table ON deletion_log(table_name, record_id);
