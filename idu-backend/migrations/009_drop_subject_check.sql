-- 009: Remove hardcoded subject CHECK constraint from questions table
-- The constraint only allowed ('algo','ai','math','db','web') but now
-- subjects are dynamic (stored in the subjects table), so any subject code is valid.

ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_subject_check;
