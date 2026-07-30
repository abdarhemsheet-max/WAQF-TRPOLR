-- ============================================================
--  طلاب التصفية — سجل مستقل عن جدول الطلاب الأساسي
-- ============================================================

-- 1) جدول طلاب التصفية (سجل جديد منفصل عن students)
create table if not exists public.finals_students (
    id                  uuid primary key default gen_random_uuid(),
    name                text not null,
    guardian_phone      text not null default '',
    memorization_center text not null default '',
    level               text not null default 'التمهيدي',
    matn                text not null default '',
    progress            numeric(5,2) not null default 0
                        check (progress >= 0 and progress <= 100),
    created_by          uuid references public.users(id) on delete set null,
    created_at          timestamptz not null default now()
);

alter table public.finals_students enable row level security;
grant all on public.finals_students to anon, authenticated;

drop policy if exists fs_select on public.finals_students;
create policy fs_select on public.finals_students for select to anon, authenticated using (true);
drop policy if exists fs_insert on public.finals_students;
create policy fs_insert on public.finals_students for insert to anon, authenticated with check (true);
drop policy if exists fs_update on public.finals_students;
create policy fs_update on public.finals_students for update to anon, authenticated using (true) with check (true);
drop policy if exists fs_delete on public.finals_students;
create policy fs_delete on public.finals_students for delete to anon, authenticated using (true);

-- 2) إضافة finals_student_id إلى committee_queue (بديل اختياري عن student_id)
alter table public.committee_queue
    add column if not exists finals_student_id uuid
    references public.finals_students(id) on delete cascade;

-- 3) ربط التقييمات الجديدة: كل سجل تقييم يشير إلى finals_student_id أيضاً
alter table public.qualification_evaluations
    add column if not exists finals_student_id uuid
    references public.finals_students(id) on delete cascade;

-- 4) بيانات تجريبية
insert into public.finals_students (name, guardian_phone, memorization_center, level, matn, progress, created_by)
select 'أحمد المختار', '218912345001', 'مركز تحفيظ الأوقاف', 'الأول', 'متن الجزرية', 85, id
from public.users where name = 'عبدالرحمن الشمري' and role = 'teacher'
limit 1;

insert into public.finals_students (name, guardian_phone, memorization_center, level, matn, progress, created_by)
select 'خالد التومي', '218912345002', 'مركز سيدي سالم', 'الثاني', 'متن الشاطبية', 70, id
from public.users where name = 'عبدالرحمن الشمري' and role = 'teacher'
limit 1;

notify pgrst, 'reload schema';
