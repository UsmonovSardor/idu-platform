-- =============================================================================
-- IDU Platform — Production ma'lumotlarini tozalash
-- DIQQAT: Bu script barcha test foydalanuvchi, talaba, ustoz ma'lumotlarini o'chiradi
-- Faqat dekanat/admin akkauntlari qoladi
-- =============================================================================

BEGIN;

-- 1. Barcha exam attempt va security loglarni o'chirish
DELETE FROM exam_security_logs;
DELETE FROM exam_results_log;
DELETE FROM exam_attempts;

-- 2. Savollarni o'chirish (qayta kiritiladi)
DELETE FROM questions;

-- 3. Baholar va darslar
DELETE FROM grades;
DELETE FROM schedule;
DELETE FROM submissions;
DELETE FROM assignments;
DELETE FROM applications;
DELETE FROM announcements;
DELETE FROM certificates;

-- 4. Kurslarni o'chirish
DELETE FROM courses;

-- 5. Ustoz va talaba profillarini o'chirish
DELETE FROM teachers;
DELETE FROM students;

-- 6. Foydalanuvchilarni o'chirish (faqat admin/dekanat qoladi)
-- DIQQAT: 'admin' va 'dekanat' rollaridagi akkauntlar SAQLANADI
DELETE FROM users
WHERE role NOT IN ('admin', 'dekanat');

-- 7. Exam session state ni reset qilish
UPDATE exam_sessions SET is_open = FALSE, opened_at = NULL, closes_at = NULL;

-- 8. Serial sequence larni reset (ixtiyoriy)
-- SELECT setval('users_id_seq', 1, false);
-- SELECT setval('students_id_seq', 1, false);
-- SELECT setval('teachers_id_seq', 1, false);

COMMIT;

-- Natijani tekshirish
SELECT 'users' AS tbl, COUNT(*) FROM users
UNION ALL SELECT 'students', COUNT(*) FROM students
UNION ALL SELECT 'teachers', COUNT(*) FROM teachers
UNION ALL SELECT 'courses', COUNT(*) FROM courses
UNION ALL SELECT 'questions', COUNT(*) FROM questions
UNION ALL SELECT 'exam_attempts', COUNT(*) FROM exam_attempts;
