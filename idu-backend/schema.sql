-- =============================================================================
-- IDU Platform — PostgreSQL Schema
-- Version 1.0    (run with: psql -U idu_user -d idu_platform -f schema.sql)
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- for fast ILIKE searches

-- -----------------------------------------------------------------------------
-- USERS  (base table for all roles)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    full_name     VARCHAR(100)        NOT NULL,
    email         VARCHAR(255)        NOT NULL UNIQUE,
    password_hash VARCHAR(255)        NOT NULL,
    role          VARCHAR(20)         NOT NULL CHECK (role IN ('student','teacher','dekanat','investor','admin')),
    phone         VARCHAR(20),
    avatar_url    VARCHAR(500),
    is_active     BOOLEAN             NOT NULL DEFAULT TRUE,
    last_login    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email  ON users (email);
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
