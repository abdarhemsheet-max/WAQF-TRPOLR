-- ============================================================
--  نظام متابعة إنجاز الطلاب — مخطط قاعدة البيانات (Supabase)
--  شغّل هذا الملف كاملاً في: Supabase Studio > SQL Editor
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1) جدول المستخدمين (أدمن / محفّظ)
-- ------------------------------------------------------------
create table if not exists public.users (
    id             uuid primary key default gen_random_uuid(),
    name           text not null,
    role           text not null check (role in ('admin', 'teacher')),
    passcode       text not null,
    halaqa_number  text,                          -- رمز الحلقة، للمحفّظين فقط
    created_at     timestamptz not null default now()
);

-- لا يجوز تكرار نفس الاسم داخل نفس الدور
create unique index if not exists users_name_role_uniq
    on public.users (lower(btrim(name)), role);

-- رمز الدخول فريد على مستوى النظام
create unique index if not exists users_passcode_uniq
    on public.users (passcode);

-- المحفّظ يجب أن يملك رمز حلقة، والأدمن لا يملك حلقة
alter table public.users drop constraint if exists users_halaqa_rule;
alter table public.users add constraint users_halaqa_rule check (
    (role = 'teacher' and halaqa_number is not null and btrim(halaqa_number) <> '')
    or (role = 'admin')
);

-- ------------------------------------------------------------
-- 2) جدول الطلاب
-- ------------------------------------------------------------
create table if not exists public.students (
    id              uuid primary key default gen_random_uuid(),
    student_number  text not null unique,   -- يُولَّد تلقائياً ولا يُعرض في الجدول
    name            text not null,
    level           text not null default 'التمهيدي',
    matn            text not null default '',
    progress        numeric(5,2) not null default 0
                    check (progress >= 0 and progress <= 100),
    notes           text not null default '',
    guardian_phone      text not null default '',   -- رقم ولي الأمر بالصيغة الدولية بلا +
    memorization_center text not null default '',   -- مركز التحفيظ
    voice_rating        numeric(3,1) not null default 0
                        check (voice_rating >= 0 and voice_rating <= 10),  -- تقييم الصوت من 10
    teacher_id          uuid references public.users(id) on delete set null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- ترقية قواعد البيانات المنشأة قبل إضافة رقم ولي الأمر
alter table public.students
    add column if not exists guardian_phone text not null default '';

-- ترقية قواعد البيانات المنشأة قبل إضافة مركز التحفيظ
alter table public.students
    add column if not exists memorization_center text not null default '';

-- ترقية قواعد البيانات المنشأة قبل إضافة تقييم الصوت
alter table public.students
    add column if not exists voice_rating numeric(3,1) not null default 0;

create index if not exists students_teacher_idx on public.students (teacher_id);
create index if not exists students_number_idx  on public.students (student_number);
create index if not exists students_name_idx    on public.students (name);

-- تحديث updated_at تلقائياً
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists students_touch_updated_at on public.students;
create trigger students_touch_updated_at
    before update on public.students
    for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- 2.0) رقم الطالب: تسلسل ذرّي على مستوى قاعدة البيانات
--
-- توليد الرقم في العميل (قراءة أكبر رقم ثم الإدراج) ينتج أرقاماً
-- مكرّرة حين يضيف محفّظان في نفس اللحظة. التسلسل يحسم الرقم داخل
-- المعاملة نفسها فلا يتكرر أبداً مهما بلغ عدد المستخدمين المتزامنين.
-- ------------------------------------------------------------
create sequence if not exists public.student_number_seq as bigint start with 2001;

-- مزامنة التسلسل مع أكبر رقم موجود (آمنة للتشغيل المتكرر)
select setval(
    'public.student_number_seq',
    greatest(
        2000,
        coalesce(
            (select max(student_number::bigint)
             from public.students
             where student_number ~ '^[0-9]+$'),
            2000
        )
    )
);

create or replace function public.assign_student_number()
returns trigger
language plpgsql
as $$
begin
    -- العميل يُدرج بلا رقم، وقاعدة البيانات تتولّى التخصيص
    if new.student_number is null or btrim(new.student_number) = '' then
        new.student_number := nextval('public.student_number_seq')::text;
    end if;
    return new;
end;
$$;

drop trigger if exists students_assign_number on public.students;
create trigger students_assign_number
    before insert on public.students
    for each row execute function public.assign_student_number();

grant usage, select on sequence public.student_number_seq to anon, authenticated;

-- ------------------------------------------------------------
-- 2.1) قوالب الرسائل ذات المتغيّرات الديناميكية
-- ------------------------------------------------------------
create table if not exists public.message_templates (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    body        text not null,
    is_locked   boolean not null default false,   -- القالب الرسمي: يُقرأ ولا يُعدّل
    teacher_id  uuid references public.users(id) on delete cascade,
    created_at  timestamptz not null default now()
);

create index if not exists templates_teacher_idx on public.message_templates (teacher_id);

-- ------------------------------------------------------------
-- 2.2) تقارير المراسلة الجماعية (أرشفة تلقائية بأمر واحد)
-- ------------------------------------------------------------
create table if not exists public.message_reports (
    id             uuid primary key default gen_random_uuid(),
    teacher_id     uuid references public.users(id) on delete set null,
    teacher_name   text not null default '',
    template_name  text not null default '',
    total_count    integer not null default 0,
    opened_count   integer not null default 0,   -- محادثات فُتحت فعلاً
    blocked_count  integer not null default 0,   -- حجبها المتصفح
    started_at     timestamptz,
    finished_at    timestamptz,
    details        jsonb not null default '[]'::jsonb,
    created_at     timestamptz not null default now()
);

create index if not exists reports_teacher_idx on public.message_reports (teacher_id);
create index if not exists reports_created_idx on public.message_reports (created_at desc);

-- ------------------------------------------------------------
-- 2.3) طابور الرسائل: الواجهة تُدرج، السيرفر المحلي يقرأ ويرسل
-- ------------------------------------------------------------
create table if not exists public.messages_queue (
    id             uuid primary key default gen_random_uuid(),
    batch_id       uuid not null default gen_random_uuid(),
    phone          text not null,
    message        text not null,
    student_name   text not null default '',
    status         text not null default 'pending'
                   check (status in ('pending', 'sending', 'sent', 'failed')),
    error          text not null default '',
    created_at     timestamptz not null default now(),
    finished_at    timestamptz
);

create index if not exists queue_status_idx on public.messages_queue (status);
create index if not exists queue_batch_idx  on public.messages_queue (batch_id);

-- ------------------------------------------------------------
-- 3) تفعيل RLS
-- ------------------------------------------------------------
alter table public.users             enable row level security;
alter table public.students          enable row level security;
alter table public.message_templates enable row level security;
alter table public.message_reports   enable row level security;
alter table public.messages_queue    enable row level security;

-- --- صلاحيات الأعمدة: عمود passcode غير قابل للقراءة إطلاقاً من العميل ---
revoke all on public.users from anon, authenticated;

grant select (id, name, role, halaqa_number, created_at)
    on public.users to anon, authenticated;

grant insert (id, name, role, passcode, halaqa_number)
    on public.users to anon, authenticated;

grant update (name, role, passcode, halaqa_number)
    on public.users to anon, authenticated;

grant delete on public.users to anon, authenticated;

grant all on public.students          to anon, authenticated;
grant all on public.message_templates to anon, authenticated;
grant all on public.message_reports   to anon, authenticated;
grant all on public.messages_queue    to anon, authenticated;

-- --- سياسات users ---
drop policy if exists users_select on public.users;
create policy users_select on public.users
    for select to anon, authenticated using (true);

drop policy if exists users_insert on public.users;
create policy users_insert on public.users
    for insert to anon, authenticated with check (role in ('admin', 'teacher'));

drop policy if exists users_update on public.users;
create policy users_update on public.users
    for update to anon, authenticated using (true) with check (true);

drop policy if exists users_delete on public.users;
create policy users_delete on public.users
    for delete to anon, authenticated using (role <> 'admin');

-- --- سياسات students ---
drop policy if exists students_select on public.students;
create policy students_select on public.students
    for select to anon, authenticated using (true);

drop policy if exists students_insert on public.students;
create policy students_insert on public.students
    for insert to anon, authenticated with check (teacher_id is not null);

drop policy if exists students_update on public.students;
create policy students_update on public.students
    for update to anon, authenticated using (true) with check (true);

drop policy if exists students_delete on public.students;
create policy students_delete on public.students
    for delete to anon, authenticated using (true);

-- --- سياسات القوالب ---
drop policy if exists templates_select on public.message_templates;
create policy templates_select on public.message_templates
    for select to anon, authenticated using (true);

drop policy if exists templates_insert on public.message_templates;
create policy templates_insert on public.message_templates
    for insert to anon, authenticated with check (is_locked = false);

drop policy if exists templates_update on public.message_templates;
create policy templates_update on public.message_templates
    for update to anon, authenticated using (is_locked = false) with check (is_locked = false);

-- القالب الرسمي محميّ من الحذف على مستوى قاعدة البيانات
drop policy if exists templates_delete on public.message_templates;
create policy templates_delete on public.message_templates
    for delete to anon, authenticated using (is_locked = false);

-- --- سياسات طابور الرسائل: يُقرأ ويُدرَج ويُحدَّث بحرية ---
drop policy if exists queue_select on public.messages_queue;
create policy queue_select on public.messages_queue
    for select to anon, authenticated using (true);

drop policy if exists queue_insert on public.messages_queue;
create policy queue_insert on public.messages_queue
    for insert to anon, authenticated with check (true);

drop policy if exists queue_update on public.messages_queue;
create policy queue_update on public.messages_queue
    for update to anon, authenticated using (true) with check (true);

-- --- سياسات التقارير: تُكتب ولا تُعدّل ولا تُحذف (سجل أرشيفي) ---
drop policy if exists reports_select on public.message_reports;
create policy reports_select on public.message_reports
    for select to anon, authenticated using (true);

drop policy if exists reports_insert on public.message_reports;
create policy reports_insert on public.message_reports
    for insert to anon, authenticated with check (true);

-- ------------------------------------------------------------
-- 4) دالة تسجيل الدخول المخصّص (بدون بريد إلكتروني)
--    SECURITY DEFINER لتتمكن من مطابقة passcode دون كشفه للعميل
-- ------------------------------------------------------------
create or replace function public.login_user(
    p_role     text,
    p_name     text,
    p_passcode text
)
returns table (id uuid, name text, role text, halaqa_number text)
language sql
security definer
set search_path = public
as $$
    select u.id, u.name, u.role, u.halaqa_number
    from public.users u
    where u.role = btrim(p_role)
      and lower(btrim(u.name)) = lower(btrim(p_name))
      and u.passcode = btrim(p_passcode)
    limit 1;
$$;

revoke all on function public.login_user(text, text, text) from public;
grant execute on function public.login_user(text, text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 4.1) البث اللحظي (Realtime) — لازم حين يعمل عدة مستخدمين معاً
--      حتى يرى كل مستخدم تعديلات الآخرين بلا إعادة تحميل الصفحة
-- ------------------------------------------------------------
do $$
begin
    alter publication supabase_realtime add table public.students;
exception
    when duplicate_object then null;   -- مضاف مسبقاً
    when undefined_object then null;   -- لا توجد publication (تشغيل بلا Realtime)
end;
$$;

-- ------------------------------------------------------------
-- 5) بيانات أولية (غيّر رموز الدخول قبل الاستخدام الفعلي)
-- ------------------------------------------------------------
insert into public.users (name, role, passcode, halaqa_number)
values ('عبدالمجيد', 'admin', '20262026', null)
on conflict do nothing;

insert into public.users (name, role, passcode, halaqa_number)
values ('عبدالرحمن الشمري', 'teacher', 'T-101', 'الأولى')
on conflict do nothing;

-- القالب الرسمي: مقفل، ويجب أن يبقى مطابقاً حرفياً لما في src/utils/templates.js
insert into public.message_templates (name, body, is_locked, teacher_id)
select
    'الصيغة الرسمية المعتمدة',
    'مكتب أوقاف طرابلس المركز قسم شؤون القران الكريم والسنة النبوية' || chr(10) ||
    'ملخص إنجاز الطالب :'                                            || chr(10) ||
    '{اسم_الطالب}'                                                   || chr(10) ||
    'المستوى: {المستوى}'                                             || chr(10) ||
    'نسبة الإنجاز : {النسبة}% من المستوى {المستوى}.'                  || chr(10) ||
    '{الملاحظة}',
    true,
    null
where not exists (select 1 from public.message_templates where is_locked = true);
