-- =============================================================================
-- 024_perf_indexes.sql
-- Missing indexes identified from slow-query analysis.
-- All use IF NOT EXISTS so re-running is safe.
-- =============================================================================

-- grades: student lookups by academic year (common in dashboards)
CREATE INDEX IF NOT EXISTS idx_grades_student_year
  ON grades (student_id, academic_year DESC);

-- grades: course + semester filter (dekanat reports)
CREATE INDEX IF NOT EXISTS idx_grades_course_sem
  ON grades (course_id, semester);

-- exam_attempts: student + type (my exams list)
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_type
  ON exam_attempts (student_id, exam_type);

-- assignments: due date filter (dashboard tasks)
CREATE INDEX IF NOT EXISTS idx_assignments_due
  ON assignments (due_date) WHERE is_active = TRUE;

-- attendance: student + course (attendance history)
CREATE INDEX IF NOT EXISTS idx_attendance_student_course
  ON attendance (student_id, course_id);

-- messages: room + created (chat history pagination)
CREATE INDEX IF NOT EXISTS idx_messages_room_created
  ON messages (room_id, created_at DESC);

-- forum posts: latest posts feed
CREATE INDEX IF NOT EXISTS idx_forum_posts_created
  ON forum_posts (created_at DESC) WHERE is_active = TRUE;

-- users: email lookup (password reset)
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users (email) WHERE email IS NOT NULL;

-- schedule: tenant-aware schedule lookup
CREATE INDEX IF NOT EXISTS idx_schedule_active_weekday
  ON schedule (is_active, weekday, faculty, year_of_study)
  WHERE is_active = TRUE;

-- Partial index for active courses per tenant
CREATE INDEX IF NOT EXISTS idx_courses_active_tenant
  ON courses (tenant_id, is_active) WHERE is_active = TRUE;
