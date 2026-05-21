-- 002_attendance.sql
-- QR-code based attendance system

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id            SERIAL PRIMARY KEY,
  teacher_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject       VARCHAR(100) NOT NULL,
  group_name    VARCHAR(50)  NOT NULL,
  room          VARCHAR(50),
  session_code  VARCHAR(12)  NOT NULL UNIQUE, -- short code for manual entry
  qr_token      VARCHAR(64)  NOT NULL UNIQUE, -- full token in QR payload
  expires_at    TIMESTAMPTZ  NOT NULL,
  closed_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id            SERIAL PRIMARY KEY,
  session_id    INTEGER NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  marked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  method        VARCHAR(20) NOT NULL DEFAULT 'qr', -- 'qr' | 'manual' | 'code'
  UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_teacher ON attendance_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_code    ON attendance_sessions(session_code);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_token   ON attendance_sessions(qr_token);
CREATE INDEX IF NOT EXISTS idx_attendance_records_session  ON attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student  ON attendance_records(student_id);
