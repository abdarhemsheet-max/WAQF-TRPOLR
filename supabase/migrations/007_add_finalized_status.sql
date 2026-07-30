-- إضافة حالة "finalized" إلى committee_queue
alter table public.committee_queue
    drop constraint if exists committee_queue_status_check;

alter table public.committee_queue
    add constraint committee_queue_status_check
    check (status in ('pending', 'evaluated', 'finalized'));

-- إضافة approved_by وحقل التثبيت
alter table public.committee_queue
    add column if not exists approved_by uuid
    references public.users(id) on delete set null;

alter table public.committee_queue
    add column if not exists finalized_score numeric(5,2);

notify pgrst, 'reload schema';
