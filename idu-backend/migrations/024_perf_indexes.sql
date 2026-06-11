-- =============================================================================
-- 024_perf_indexes.sql
-- Performance indexes — verified against actual table/column names.
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

-- assignments: deadline sort (dashboard tasks; column is 'deadline' not 'due_date')
CREATE INDEX IF NOT EXISTS idx_assignments_deadline
  ON assignments (deadline ASC);

-- attendance_records: student lookup (table is attendance_records, joined via session)
CREATE INDEX IF NOT EXISTS idx_attendance_records_student
  ON attendance_records (student_id);

-- chat_messages: room + created (chat history pagination; table is chat_messages)
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created
  ON chat_messages (room_id, created_at DESC);

-- forum_questions: latest posts feed (table is forum_questions, no is_active column)
CREATE INDEX IF NOT EXISTS idx_forum_questions_created
  ON forum_questions (created_at DESC);

-- users: email lookup (password reset)
CREATE INDEX IF NOT EXISTS idx_users_email
  ON users (email) WHERE email IS NOT NULL;

-- schedule: composite index for active schedule lookup by faculty+year+weekday
CREATE INDEX IF NOT EXISTS idx_schedule_active_faculty
  ON schedule (faculty, year_of_study, weekday)
  WHERE is_active = TRUE;

-- courses: active courses per tenant (tenant_id added by migration 023)
CREATE INDEX IF NOT EXISTS idx_courses_tenant_active
  ON courses (tenant_id)
  WHERE is_active = TRUE;
