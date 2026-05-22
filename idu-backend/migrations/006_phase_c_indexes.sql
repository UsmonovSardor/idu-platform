-- 006_phase_c_indexes.sql  — Phase C: missing indexes + query optimisation
-- All statements are idempotent (CREATE INDEX IF NOT EXISTS).
-- NOTE: audit_log, failed_logins indexes already created in 005_audit_security.sql
--       Only NEW indexes are added here to avoid duplicates.

-- ── pg_trgm extension ────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── students table ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_students_group_name
  ON students (group_name);

CREATE INDEX IF NOT EXISTS idx_students_year
  ON students (year_of_study);

-- GIN trigram: fast ILIKE '%...%' on full_name (no seq-scan)
CREATE INDEX IF NOT EXISTS idx_users_full_name_trgm
  ON users USING gin (full_name gin_trgm_ops);

-- GIN trigram on student_id_number
CREATE INDEX IF NOT EXISTS idx_students_id_number_trgm
  ON students USING gin (student_id_number gin_trgm_ops);

-- ── users table ───────────────────────────────────────────────────────────────
-- Composite: u.role = 'student' AND u.is_active = TRUE
CREATE INDEX IF NOT EXISTS idx_users_role_active
  ON users (role, is_active);

-- ── attendance_sessions ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_att_sessions_expires
  ON attendance_sessions (expires_at);

CREATE INDEX IF NOT EXISTS idx_att_sessions_group_created
  ON attendance_sessions (group_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_att_sessions_subject
  ON attendance_sessions (subject);

-- ── account_lockouts ─────────────────────────────────────────────────────────
-- Column is locked_until (NOT expires_at) — see 005_audit_security.sql
CREATE INDEX IF NOT EXISTS idx_account_lockouts_login
  ON account_lockouts (login, locked_until);

-- ── exam_attempts ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attempts_student_submitted
  ON exam_attempts (student_id, submitted_at DESC);

-- ── messages / chat ───────────────────────────────────────────────────────────
-- Reverse-direction index: "all rooms of user"
CREATE INDEX IF NOT EXISTS idx_room_members_user
  ON chat_room_members (user_id, room_id);

-- Partial index: skip deleted messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_active
  ON chat_messages (room_id, created_at DESC)
  WHERE NOT is_deleted;

-- ── ANALYSE so planner uses new indexes immediately ───────────────────────────
ANALYSE users;
ANALYSE students;
ANALYSE attendance_sessions;
ANALYSE exam_attempts;
ANALYSE chat_room_members;
ANALYSE chat_messages;
