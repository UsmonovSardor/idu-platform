-- Missing performance indexes identified in audit
-- chat_messages.sender_id — used in soft-delete WHERE sender_id=$1
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id
  ON chat_messages(sender_id);

-- chat_room_members.user_id — used in membership lookups
CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_id
  ON chat_room_members(user_id);

-- failed_logins.login + attempted_at — used in brute-force window COUNT
CREATE INDEX IF NOT EXISTS idx_failed_logins_login_time
  ON failed_logins(login, attempted_at);

-- xp_log.user_id — used in XP history queries
CREATE INDEX IF NOT EXISTS idx_xp_log_user_id
  ON xp_log(user_id);
