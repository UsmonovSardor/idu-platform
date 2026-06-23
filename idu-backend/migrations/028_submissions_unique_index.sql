-- Migration 028: Add unique constraint on submissions(assignment_id, student_id)
-- Required for the ON CONFLICT upsert in routes/submissions.js
-- Prevents duplicate submissions from race conditions.

CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_unique
  ON submissions(assignment_id, student_id);
