-- ============================================================
--  نظام التصفية ولجان التحكيم — دورة حفاظ الوحيين
--  شغّل هذا الملف في: Supabase Studio > SQL Editor
-- ============================================================

-- ------------------------------------------------------------
-- 1) جدول لجان التحكيم
-- ------------------------------------------------------------
create table if not exists public.committees (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    room        text not null default '',
    created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2) أعضاء اللجان (كل محفّظ مرتبط بلجنة واحدة على الأكثر)
-- ------------------------------------------------------------
create table if not exists public.committee_members (
    id            uuid primary key default gen_random_uuid(),
    committee_id  uuid not null references public.committees(id) on delete cascade,
    user_id       uuid not null references public.users(id) on delete cascade,
    is_head       boolean not null default false,
    created_at    timestamptz not null default now(),
    unique (committee_id, user_id)
);

-- المحفّظ لا يمكن أن يكون رئيساً إلا في لجنة واحدة
create unique index if not exists committee_heads_uniq
    on public.committee_members (user_id) where is_head = true;

-- ------------------------------------------------------------
-- 3) طابور التصفية (الطلاب المنتظرون للتقييم)
-- ------------------------------------------------------------
create table if not exists public.committee_queue (
    id            uuid primary key default gen_random_uuid(),
    committee_id  uuid not null references public.committees(id) on delete cascade,
    student_id    uuid not null references public.students(id) on delete cascade,
    added_by      uuid references public.users(id) on delete set null,
    status        text not null default 'pending'
                  check (status in ('pending', 'evaluated')),
    created_at    timestamptz not null default now(),
    evaluated_at  timestamptz
);

-- منع تكرار نفس الطالب في الطابور لنفس اللجنة
create unique index if not exists queue_student_committee_uniq
    on public.committee_queue (committee_id, student_id) where status = 'pending';

-- ------------------------------------------------------------
-- 4) تقييمات التصفية — سجل لكل تقييم يقدّمه عضو اللجنة
-- ------------------------------------------------------------
create table if not exists public.qualification_evaluations (
    id              uuid primary key default gen_random_uuid(),
    queue_id        uuid not null references public.committee_queue(id) on delete cascade,
    student_id      uuid not null references public.students(id) on delete cascade,
    evaluator_id    uuid references public.users(id) on delete set null,
    voice_score     numeric(3,1) not null default 0
                    check (voice_score >= 0 and voice_score <= 10),
    deductions      jsonb not null default '{}'::jsonb,
    final_score     numeric(5,2) not null default 0
                    check (final_score >= 0 and final_score <= 100),
    created_at      timestamptz not null default now(),
    unique (queue_id, evaluator_id)
);

-- ------------------------------------------------------------
-- 5) Indexes
-- ------------------------------------------------------------
create index if not exists committee_members_committee_idx
    on public.committee_members (committee_id);
create index if not exists committee_members_user_idx
    on public.committee_members (user_id);
create index if not exists queue_committee_idx
    on public.committee_queue (committee_id);
create index if not exists queue_status_idx
    on public.committee_queue (status);
create index if not exists qual_eval_queue_idx
    on public.qualification_evaluations (queue_id);
create index if not exists qual_eval_evaluator_idx
    on public.qualification_evaluations (evaluator_id);

-- ------------------------------------------------------------
-- 6) RLS
-- ------------------------------------------------------------
alter table public.committees                enable row level security;
alter table public.committee_members          enable row level security;
alter table public.committee_queue           enable row level security;
alter table public.qualification_evaluations enable row level security;

grant all on public.committees                to anon, authenticated;
grant all on public.committee_members         to anon, authenticated;
grant all on public.committee_queue          to anon, authenticated;
grant all on public.qualification_evaluations to anon, authenticated;

-- سياسات committees
drop policy if exists committees_select on public.committees;
create policy committees_select on public.committees
    for select to anon, authenticated using (true);
drop policy if exists committees_insert on public.committees;
create policy committees_insert on public.committees
    for insert to anon, authenticated with check (true);
drop policy if exists committees_update on public.committees;
create policy committees_update on public.committees
    for update to anon, authenticated using (true) with check (true);
drop policy if exists committees_delete on public.committees;
create policy committees_delete on public.committees
    for delete to anon, authenticated using (true);

-- سياسات committee_members
drop policy if exists cm_select on public.committee_members;
create policy cm_select on public.committee_members
    for select to anon, authenticated using (true);
drop policy if exists cm_insert on public.committee_members;
create policy cm_insert on public.committee_members
    for insert to anon, authenticated with check (true);
drop policy if exists cm_update on public.committee_members;
create policy cm_update on public.committee_members
    for update to anon, authenticated using (true) with check (true);
drop policy if exists cm_delete on public.committee_members;
create policy cm_delete on public.committee_members
    for delete to anon, authenticated using (true);

-- سياسات committee_queue
drop policy if exists cq_select on public.committee_queue;
create policy cq_select on public.committee_queue
    for select to anon, authenticated using (true);
drop policy if exists cq_insert on public.committee_queue;
create policy cq_insert on public.committee_queue
    for insert to anon, authenticated with check (true);
drop policy if exists cq_update on public.committee_queue;
create policy cq_update on public.committee_queue
    for update to anon, authenticated using (true) with check (true);
drop policy if exists cq_delete on public.committee_queue;
create policy cq_delete on public.committee_queue
    for delete to anon, authenticated using (true);

-- سياسات qualification_evaluations
drop policy if exists qe_select on public.qualification_evaluations;
create policy qe_select on public.qualification_evaluations
    for select to anon, authenticated using (true);
drop policy if exists qe_insert on public.qualification_evaluations;
create policy qe_insert on public.qualification_evaluations
    for insert to anon, authenticated with check (true);
drop policy if exists qe_update on public.qualification_evaluations;
create policy qe_update on public.qualification_evaluations
    for update to anon, authenticated using (true) with check (true);
drop policy if exists qe_delete on public.qualification_evaluations;
create policy qe_delete on public.qualification_evaluations
    for delete to anon, authenticated using (true);

-- ------------------------------------------------------------
-- 7) بيانات أولية للتصفية
-- ------------------------------------------------------------
insert into public.committees (name, room)
values ('لجنة التحكيم الأولى', 'الغرفة 121')
on conflict do nothing;

insert into public.committees (name, room)
values ('لجنة التحكيم الثانية', 'الغرفة 122')
on conflict do nothing;

-- ربط المحفّظين باللجنة الأولى (عبدالرحمن الشمري رئيساً)
insert into public.committee_members (committee_id, user_id, is_head)
select c.id, u.id, true
from public.committees c, public.users u
where c.name = 'لجنة التحكيم الأولى'
  and u.name = 'عبدالرحمن الشمري'
  and u.role = 'teacher'
on conflict do nothing;

insert into public.committee_members (committee_id, user_id, is_head)
select c.id, u.id, false
from public.committees c, public.users u
where c.name = 'لجنة التحكيم الأولى'
  and u.name = 'سعد الحربي'
  and u.role = 'teacher'
on conflict do nothing;
