-- Performance indexes — runs once via migrate.js
-- All use IF NOT EXISTS so re-running is safe.

-- users: login lookup (auth hot path)
CREATE INDEX IF NOT EXISTS idx_users_login     ON users (LOWER(login));
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);

-- students: join with users
CREATE INDEX IF NOT EXISTS idx_students_user_id          ON students (user_id);
CREATE INDEX IF NOT EXISTS idx_students_faculty          ON students (faculty);
CREATE INDEX IF NOT EXISTS idx_students_year_of_study    ON students (year_of_study);

-- grades: most frequent filter combos
CREATE INDEX IF NOT EXISTS idx_grades_student_id         ON grades (student_id);
CREATE INDEX IF NOT EXISTS idx_grades_semester           ON grades (semester);
CREATE INDEX IF NOT EXISTS idx_grades_student_semester   ON grades (student_id, semester);

-- exam_attempts
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_id  ON exam_attempts (student_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_status      ON exam_attempts (status);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_submitted   ON exam_attempts (submitted_at DESC);

-- schedule
CREATE INDEX IF NOT EXISTS idx_schedule_group_id         ON schedule (group_id);
CREATE INDEX IF NOT EXISTS idx_schedule_day_time         ON schedule (day_of_week, start_time);
CREATE INDEX IF NOT EXISTS idx_schedule_teacher_id       ON schedule (teacher_id);

-- applications
CREATE INDEX IF NOT EXISTS idx_applications_student_id   ON applications (student_id);
CREATE INDEX IF NOT EXISTS idx_applications_status       ON applications (status);
CREATE INDEX IF NOT EXISTS idx_applications_created_at   ON applications (created_at DESC);
