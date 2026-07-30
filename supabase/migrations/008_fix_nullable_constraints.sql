-- ============================================================
--  إصلاح NOT NULL constraints لاستقبال طلاب التصفية
-- ============================================================

-- 1) committee_queue: student_id يصبح اختيارياً
alter table public.committee_queue
    alter column student_id drop not null;

-- 2) qualification_evaluations: student_id يصبح اختيارياً
alter table public.qualification_evaluations
    alter column student_id drop not null;

-- 3) finals_students: guardian_phone يصبح اختيارياً (بدون default)
alter table public.finals_students
    alter column guardian_phone drop default,
    alter column guardian_phone set data type text using nullif(guardian_phone, ''),
    alter column guardian_phone drop not null;

-- 4) إزالة unique index الذي يعتمد على student_id (لأنه قد يصبح null)
drop index if exists public.queue_student_committee_uniq;

-- إنشاء unique index جديد يتجاهل القيم الخالية
create unique index if not exists queue_student_committee_uniq
    on public.committee_queue (committee_id, coalesce(student_id, '00000000-0000-0000-0000-000000000000'::uuid))
    where status = 'pending' and student_id is not null;

-- 5) مؤشر منفصل لـ finals_student_id
create unique index if not exists queue_finals_student_committee_uniq
    on public.committee_queue (committee_id, finals_student_id) where status = 'pending' and finals_student_id is not null;

notify pgrst, 'reload schema';
