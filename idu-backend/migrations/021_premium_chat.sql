-- 021_premium_chat.sql — Telegram-grade chat upgrade for IDU.
-- Adds: reply/quote, edit/soft-delete, emoji reactions, read receipts,
-- presence (last_seen), and lightweight attachment metadata.
-- All additive & idempotent so it can run safely on the live DB.

-- ── chat_messages: reply, edit, attachments ─────────────────────────────────
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_to_id     INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS edited_at       TIMESTAMPTZ;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_url  TEXT;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_type VARCHAR(24);   -- 'image' | 'file'
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_name TEXT;

CREATE INDEX IF NOT EXISTS idx_chat_messages_reply ON chat_messages(reply_to_id);

-- ── chat_reactions: one emoji per (message,user,emoji) ──────────────────────
CREATE TABLE IF NOT EXISTS chat_reactions (
  id          SERIAL PRIMARY KEY,
  message_id  INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji       VARCHAR(16) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_chat_reactions_msg ON chat_reactions(message_id);

-- ── read receipts: track each member's last-read message ────────────────────
ALTER TABLE chat_room_members ADD COLUMN IF NOT EXISTS last_read_message_id INTEGER;
ALTER TABLE chat_room_members ADD COLUMN IF NOT EXISTS last_read_at         TIMESTAMPTZ;

-- ── presence: when a user was last online (updated on socket activity) ───────
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;
