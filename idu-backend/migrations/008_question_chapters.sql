-- 008: Add chapter_num to questions for PDF chapter grouping
-- Every 20 uploaded questions auto-get a chapter number (1, 2, 3, …)

ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS chapter_num INTEGER NOT NULL DEFAULT 1;

-- Index for fast chapter-based lookup
CREATE INDEX IF NOT EXISTS idx_questions_subject_chapter
  ON questions (subject, chapter_num)
  WHERE is_active = TRUE;

-- Retroactively assign chapter numbers to existing questions
-- (groups of 20 per subject, ordered by created_at)
DO $$
DECLARE
  subj TEXT;
  rec  RECORD;
  counter INT;
BEGIN
  FOR subj IN SELECT DISTINCT subject FROM questions WHERE is_active = TRUE LOOP
    counter := 0;
    FOR rec IN
      SELECT id FROM questions
      WHERE subject = subj AND is_active = TRUE
      ORDER BY id ASC
    LOOP
      UPDATE questions
         SET chapter_num = (counter / 20) + 1
       WHERE id = rec.id;
      counter := counter + 1;
    END LOOP;
  END LOOP;
END;
$$;
