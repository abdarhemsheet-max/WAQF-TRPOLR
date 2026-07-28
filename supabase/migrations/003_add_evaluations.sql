create table if not exists public.evaluations (
    id              uuid primary key default gen_random_uuid(),
    student_id      uuid not null references public.students(id) on delete cascade,
    teacher_id      uuid references public.users(id) on delete set null,
    level           text not null,
    voice_rating    numeric(3,1) not null default 0 check (voice_rating >= 0 and voice_rating <= 10),
    criteria_data   jsonb not null default '{}'::jsonb,
    created_at      timestamptz not null default now()
);

create index if not exists evaluations_student_idx on public.evaluations (student_id);
create index if not exists evaluations_created_idx on public.evaluations (created_at desc);
