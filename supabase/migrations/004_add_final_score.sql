alter table public.evaluations
    add column if not exists final_score numeric(5,2) not null default 0 check (final_score >= 0 and final_score <= 100);

alter table public.evaluations
    add column if not exists is_approved boolean not null default false;
