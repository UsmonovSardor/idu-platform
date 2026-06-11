-- Migration 027: Add ON DELETE CASCADE to FK relationships
-- Prevents orphaned child rows when a parent record is deleted.
-- All changes are safe to re-run (wrapped in DO blocks with existence checks).

-- ── grades → students / courses ──────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'grades_student_id_fkey' AND table_name = 'grades'
  ) THEN
    ALTER TABLE grades DROP CONSTRAINT grades_student_id_fkey;
    ALTER TABLE grades ADD CONSTRAINT grades_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'grades_course_id_fkey' AND table_name = 'grades'
  ) THEN
    ALTER TABLE grades DROP CONSTRAINT grades_course_id_fkey;
    ALTER TABLE grades ADD CONSTRAINT grades_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── exam_attempts → exams / students ─────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'exam_attempts_exam_id_fkey' AND table_name = 'exam_attempts'
  ) THEN
    ALTER TABLE exam_attempts DROP CONSTRAINT exam_attempts_exam_id_fkey;
    ALTER TABLE exam_attempts ADD CONSTRAINT exam_attempts_exam_id_fkey
      FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'exam_attempts_student_id_fkey' AND table_name = 'exam_attempts'
  ) THEN
    ALTER TABLE exam_attempts DROP CONSTRAINT exam_attempts_student_id_fkey;
    ALTER TABLE exam_attempts ADD CONSTRAINT exam_attempts_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── assignments → courses ─────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'assignments_course_id_fkey' AND table_name = 'assignments'
  ) THEN
    ALTER TABLE assignments DROP CONSTRAINT assignments_course_id_fkey;
    ALTER TABLE assignments ADD CONSTRAINT assignments_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── submissions → assignments / students ─────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'submissions_assignment_id_fkey' AND table_name = 'submissions'
  ) THEN
    ALTER TABLE submissions DROP CONSTRAINT submissions_assignment_id_fkey;
    ALTER TABLE submissions ADD CONSTRAINT submissions_assignment_id_fkey
      FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'submissions_student_id_fkey' AND table_name = 'submissions'
  ) THEN
    ALTER TABLE submissions DROP CONSTRAINT submissions_student_id_fkey;
    ALTER TABLE submissions ADD CONSTRAINT submissions_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── attendance → students ─────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'attendance_student_id_fkey' AND table_name = 'attendance'
  ) THEN
    ALTER TABLE attendance DROP CONSTRAINT attendance_student_id_fkey;
    ALTER TABLE attendance ADD CONSTRAINT attendance_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── forum_questions → users ───────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'forum_questions_user_id_fkey' AND table_name = 'forum_questions'
  ) THEN
    ALTER TABLE forum_questions DROP CONSTRAINT forum_questions_user_id_fkey;
    ALTER TABLE forum_questions ADD CONSTRAINT forum_questions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── invoices → students ───────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'invoices_student_id_fkey' AND table_name = 'invoices'
  ) THEN
    ALTER TABLE invoices DROP CONSTRAINT invoices_student_id_fkey;
    ALTER TABLE invoices ADD CONSTRAINT invoices_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ── payme_transactions → invoices ─────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payme_transactions_invoice_id_fkey' AND table_name = 'payme_transactions'
  ) THEN
    ALTER TABLE payme_transactions DROP CONSTRAINT payme_transactions_invoice_id_fkey;
    ALTER TABLE payme_transactions ADD CONSTRAINT payme_transactions_invoice_id_fkey
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ── students table → users ────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'students_user_id_fkey' AND table_name = 'students'
  ) THEN
    ALTER TABLE students DROP CONSTRAINT students_user_id_fkey;
    ALTER TABLE students ADD CONSTRAINT students_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
