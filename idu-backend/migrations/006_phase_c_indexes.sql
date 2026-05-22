-- 006_phase_c_indexes.sql  — Phase C: missing indexes + query optimisation
-- All statements are idempotent (CREATE INDEX IF NOT EXISTS / DO $$ blocks).

-- ── pg_trgm extension (already created in schema.sql, re-guard just in case) ──
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── students table ────────────────────────────────────────────────────────────
-- group_name is used in WHERE clauses across attendance, reports, student list
CREATE INDEX IF NOT EXISTS idx_students_group_name
  ON students (group_name);

-- year_of_study filter in student list
CREATE INDEX IF NOT EXISTS idx_students_year
  ON students (year_of_study);

-- GIN trigram index: enables fast ILIKE '%...%' on full_name without seq-scan
-- (pg_trgm turns "ILIKE '%john%'" into a GIN lookup instead of full table scan)
CREATE INDEX IF NOT EXISTS idx_users_full_name_trgm
  ON users USING gin (full_name gin_trgm_ops);

-- GIN trigram on student_id_number (search by student number)
CREATE INDEX IF NOT EXISTS idx_students_id_number_trgm
  ON students USING gin (student_id_number gin_trgm_ops);

-- ── users table ───────────────────────────────────────────────────────────────
-- Almost every query filters: u.role = 'student' AND u.is_active = TRUE
-- A composite covering index avoids a separate is_active filter pass
CREATE INDEX IF NOT EXISTS idx_users_role_active
  ON users (role, is_active);

-- ── attendance_sessions ───────────────────────────────────────────────────────
-- attendance/mark checks: qr_token lookup + expires_at check
-- qr_token already indexed; add expires_at for range checks
CREATE INDEX IF NOT EXISTS idx_att_sessions_expires
  ON attendance_sessions (expires_at);

-- Report/stats filter: WHERE s.group_name = $1 AND s.created_at >= $2
CREATE INDEX IF NOT EXISTS idx_att_sessions_group_created
  ON attendance_sessions (group_name, created_at DESC);

-- subject filter used in /report
CREATE INDEX IF NOT EXISTS idx_att_sessions_subject
  ON attendance_sessions (subject);

-- ── audit_log ─────────────────────────────────────────────────────────────────
-- Audit viewer filters by user_id, action, entity, status, and date range
CREATE INDEX IF NOT EXISTS idx_audit_log_user_created
  ON audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_action_created
  ON audit_log (action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_created
  ON audit_log (created_at DESC);

-- ── failed_logins + account_lockouts ─────────────────────────────────────────
-- Login lockout queries: WHERE login = $1 AND attempted_at > NOW() - INTERVAL ...
CREATE INDEX IF NOT EXISTS idx_failed_logins_login_time
  ON failed_logins (login, attempted_at DESC);

-- Lockout lookup: WHERE login = $1 AND expires_at > NOW()
CREATE INDEX IF NOT EXISTS idx_account_lockouts_login
  ON account_lockouts (login, expires_at);

-- ── exam_attempts ─────────────────────────────────────────────────────────────
-- Student history: WHERE student_id = $1 ORDER BY submitted_at DESC
CREATE INDEX IF NOT EXISTS idx_attempts_student_submitted
  ON exam_attempts (student_id, submitted_at DESC);

-- ── messages / chat ───────────────────────────────────────────────────────────
-- chat_room_members: member check (room_id, user_id) — already PK but add
-- reverse direction index for "all rooms of user" query
CREATE INDEX IF NOT EXISTS idx_room_members_user
  ON chat_room_members (user_id, room_id);

-- chat_messages: is_deleted filter (partial index — only non-deleted rows)
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_active
  ON chat_messages (room_id, created_at DESC)
  WHERE NOT is_deleted;

-- ── xp_log ───────────────────────────────────────────────────────────────────
-- Leaderboard query sorts by xp DESC — user_xp already has idx_user_xp_xp
-- xp_log history: WHERE user_id = $1 ORDER BY created_at DESC already covered
-- by idx_xp_log_user; no change needed.

-- ── ANALYSE so planner uses new indexes immediately ───────────────────────────
ANALYSE users;
ANALYSE students;
ANALYSE attendance_sessions;
ANALYSE audit_log;
ANALYSE failed_logins;
ANALYSE account_lockouts;
ANALYSE exam_attempts;
ANALYSE chat_room_members;
ANALYSE chat_messages;
