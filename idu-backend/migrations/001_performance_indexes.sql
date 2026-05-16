-- Performance indexes — runs once via migrate.js (idempotent)
-- Only adds indexes not already present in schema.sql

-- Login auth uses LOWER(login) = $1 but schema only has idx_users_login(login)
-- A function-based index makes this query use an index scan instead of seq scan
CREATE INDEX IF NOT EXISTS idx_users_login_lower
  ON users (LOWER(login));

-- Grades: filter by semester and composite student+semester (common in grade views)
CREATE INDEX IF NOT EXISTS idx_grades_semester
  ON grades (semester);

CREATE INDEX IF NOT EXISTS idx_grades_student_semester
  ON grades (student_id, semester);

CREATE INDEX IF NOT EXISTS idx_grades_academic_year
  ON grades (academic_year);

-- Exam attempts: order by submitted_at for history queries
CREATE INDEX IF NOT EXISTS idx_attempts_submitted_at
  ON exam_attempts (submitted_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_attempts_exam_type
  ON exam_attempts (exam_type);

-- Applications: time-ordered listing
CREATE INDEX IF NOT EXISTS idx_applications_created_at
  ON applications (created_at DESC);
