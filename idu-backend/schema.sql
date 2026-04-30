-- =============================================================================
-- IDU Platform — PostgreSQL Schema
-- Version 1.0   (run with: psql -U idu_user -d idu_platform -f schema.sql)
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- for fast ILIKE searches

-- -----------------------------------------------------------------------------
-- USERS  (base table for all roles)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    full_name     VARCHAR(100)        NOT NULL,
    login         VARCHAR(50)         NOT NULL UNIQUE,
    password_hash VARCHAR(255)        NOT NULL,
    role          VARCHAR(20)         NOT NULL CHECK (role IN ('student','teacher','dekanat','investor','admin')),
    phone         VARCHAR(20),
    avatar_url    VARCHAR(500),
    is_active     BOOLEAN             NOT NULL DEFAULT TRUE,
    last_login    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_login  ON users (login);
CREATE INDEX IF NOT EXISTS idx_users_role   ON users (role);

-- -----------------------------------------------------------------------------
-- STUDENTS  (profile extension for role='student')
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
    id                  SERIAL PRIMARY KEY,
    user_id             INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    student_id_number   VARCHAR(20) UNIQUE,          -- e.g. IDU-2024-001
    faculty             VARCHAR(100),
    department          VARCHAR(100),
    year_of_study       SMALLINT CHECK (year_of_study BETWEEN 1 AND 6),
    gpa                 NUMERIC(4,2) DEFAULT 0.00,
    enrollment_date     DATE,
    graduation_date     DATE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_user_id ON students (user_id);
CREATE INDEX IF NOT EXISTS idx_students_faculty  ON students (faculty);

-- -----------------------------------------------------------------------------
-- TEACHERS  (profile extension for role='teacher')
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teachers (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    department  VARCHAR(100),
    title       VARCHAR(100),          -- e.g. "Dotsent", "Professor"
    bio         TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- COURSES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200)  NOT NULL,
    code        VARCHAR(20)   UNIQUE,
    description TEXT,
    credits     SMALLINT      DEFAULT 3,
    teacher_id  INT           REFERENCES users(id),
    is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courses_teacher ON courses (teacher_id);

-- -----------------------------------------------------------------------------
-- GRADES  (100-ball IDU system: JN+ON+YN+MI)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grades (
    id            SERIAL PRIMARY KEY,
    student_id    INT           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id     INT           NOT NULL REFERENCES courses(id),
    semester      SMALLINT      NOT NULL CHECK (semester BETWEEN 1 AND 8),
    academic_year VARCHAR(9)    NOT NULL,          -- e.g. '2024-2025'
    jn            NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (jn    BETWEEN 0 AND 30),
    on_score      NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (on_score BETWEEN 0 AND 20),
    yn            NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (yn    BETWEEN 0 AND 30),
    mi            NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (mi    BETWEEN 0 AND 20),
    letter_grade  VARCHAR(2)    CHECK (letter_grade IN ('A','B','C','D','F')),
    graded_by     INT           REFERENCES users(id),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, course_id, semester, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_grades_student  ON grades (student_id);
CREATE INDEX IF NOT EXISTS idx_grades_course   ON grades (course_id);

-- -----------------------------------------------------------------------------
-- SCHEDULE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedule (
    id            SERIAL PRIMARY KEY,
    course_id     INT          NOT NULL REFERENCES courses(id),
    weekday       SMALLINT     NOT NULL CHECK (weekday BETWEEN 0 AND 6),  -- 0=Mon
    start_time    TIME         NOT NULL,
    end_time      TIME         NOT NULL,
    room          VARCHAR(50),
    faculty       VARCHAR(100),
    year_of_study SMALLINT,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_faculty ON schedule (faculty, year_of_study, weekday);

-- -----------------------------------------------------------------------------
-- EXAM SESSIONS  (dekanat opens/closes test & sesiya)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exam_sessions (
    id            SERIAL PRIMARY KEY,
    exam_type     VARCHAR(10)  NOT NULL CHECK (exam_type IN ('test','sesiya')),
    is_open       BOOLEAN      NOT NULL DEFAULT FALSE,
    opened_at     TIMESTAMPTZ,
    closes_at     TIMESTAMPTZ,
    controlled_by INT          REFERENCES users(id),
    UNIQUE (exam_type)
);

INSERT INTO exam_sessions (exam_type, is_open) VALUES ('test', FALSE), ('sesiya', FALSE)
ON CONFLICT (exam_type) DO NOTHING;

-- -----------------------------------------------------------------------------
-- QUESTIONS  (dekanat-managed question bank)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS questions (
    id            SERIAL PRIMARY KEY,
    subject       VARCHAR(20)  NOT NULL CHECK (subject IN ('algo','ai','math','db','web')),
    type          VARCHAR(10)  NOT NULL CHECK (type IN ('test','real','both')),
    question_text TEXT         NOT NULL,
    option_a      TEXT         NOT NULL,
    option_b      TEXT         NOT NULL,
    option_c      TEXT         NOT NULL,
    option_d      TEXT         NOT NULL,
    correct_option VARCHAR(1)  NOT NULL CHECK (correct_option IN ('A','B','C','D')),
    explanation   TEXT,
    created_by    INT          REFERENCES users(id),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_subject_type ON questions (subject, type) WHERE is_active = TRUE;

-- Full-text search on question text
CREATE INDEX IF NOT EXISTS idx_questions_fts ON questions USING GIN (to_tsvector('english', question_text));

-- -----------------------------------------------------------------------------
-- EXAM ATTEMPTS  (one record per student per exam attempt)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exam_attempts (
    id             SERIAL PRIMARY KEY,
    student_id     INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exam_type      VARCHAR(10) NOT NULL CHECK (exam_type IN ('test','sesiya')),
    subject        VARCHAR(20) NOT NULL,
    question_ids   JSONB       NOT NULL,     -- ordered array of question IDs
    answers_json   JSONB,                    -- { questionId: chosenIndex }
    correct_count  SMALLINT,
    total_count    SMALLINT,
    score          NUMERIC(5,2),             -- 0–100
    letter_grade   VARCHAR(2),
    status         VARCHAR(20) NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active','completed','expired','cancelled')),
    started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at     TIMESTAMPTZ NOT NULL,
    submitted_at   TIMESTAMPTZ
);
    warning_count INT NOT NULL DEFAULT 0,
    suspicion_score INT NOT NULL DEFAULT 0,
    integrity_hash TEXT,
    force_submit_reason TEXT,
    saved_answers_json JSONB,
    last_heartbeat_at TIMESTAMPTZ,
    heartbeat_count INT NOT NULL DEFAULT 0

    CREATE TABLE IF NOT EXISTS exam_security_logs (
    id SERIAL PRIMARY KEY,
    attempt_id INT NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    suspicion_score INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_security_logs_attempt ON exam_security_logs(attempt_id);

CREATE INDEX IF NOT EXISTS idx_attempts_student   ON exam_attempts (student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_status    ON exam_attempts (status);

-- -----------------------------------------------------------------------------
-- EXAM RESULTS LOG  (summary log, joined from attempts)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exam_results_log (
    id           SERIAL PRIMARY KEY,
    attempt_id   INT         NOT NULL UNIQUE REFERENCES exam_attempts(id),
    student_id   INT         NOT NULL REFERENCES users(id),
    exam_type    VARCHAR(10) NOT NULL,
    subject      VARCHAR(20) NOT NULL,
    score        NUMERIC(5,2),
    letter_grade VARCHAR(2),
    logged_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- APPLICATIONS  (student requests + e'tirozlar)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS applications (
    id               SERIAL PRIMARY KEY,
    student_id       INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type             VARCHAR(20) NOT NULL CHECK (type IN ('cert','job','etiraz','other')),
    detail           TEXT        NOT NULL,
    company          VARCHAR(200),
    note             TEXT,
    -- etiraz-specific fields
    question_index   SMALLINT,
    exam_type        VARCHAR(10) CHECK (exam_type IN ('test','sesiya')),
    subject          VARCHAR(20),
    -- status management
    status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','reviewing','approved','rejected')),
    dekanat_comment  TEXT,
    reviewed_by      INT         REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applications_student ON applications (student_id);
CREATE INDEX IF NOT EXISTS idx_applications_type    ON applications (type);
CREATE INDEX IF NOT EXISTS idx_applications_status  ON applications (status);

-- -----------------------------------------------------------------------------
-- ANNOUNCEMENTS  (news / ogohlantirishlar)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(300) NOT NULL,
    body        TEXT         NOT NULL,
    audience    VARCHAR(20)  NOT NULL DEFAULT 'all'
                             CHECK (audience IN ('all','student','teacher','dekanat')),
    priority    VARCHAR(10)  NOT NULL DEFAULT 'normal'
                             CHECK (priority IN ('normal','high','urgent')),
    created_by  INT          REFERENCES users(id),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- CERTIFICATES  (issued certificates linked to students)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certificates (
    id           SERIAL PRIMARY KEY,
    student_id   INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        VARCHAR(300) NOT NULL,
    issuer       VARCHAR(200),
    issued_date  DATE,
    file_url     VARCHAR(500),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- UPDATED_AT trigger function (auto-updates updated_at on row change)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['users','grades','questions','applications'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I;
       CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END;
$$;

-- =============================================================================
-- SEED DATA — initial admin / dekanat account
-- (password: Admin@123  — CHANGE IMMEDIATELY after first login)
-- hash generated with bcrypt cost 12
-- =============================================================================
INSERT INTO users (full_name, login, password_hash, role) VALUES
  ('Dekanat Admin',  'dekanat',  crypt('admin123', gen_salt('bf', 12)), 'dekanat'),
  ('Alisher Azimov', 'alisher',  crypt('1234', gen_salt('bf', 12)), 'student'),
  ('Karimov Alisher','karimov',  crypt('admin', gen_salt('bf', 12)), 'teacher'),
  ('Bekzod Yusupov', 'invest1',  crypt('inv123', gen_salt('bf', 12)), 'investor')
ON CONFLICT (login) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  is_active = TRUE,
  updated_at = NOW();
