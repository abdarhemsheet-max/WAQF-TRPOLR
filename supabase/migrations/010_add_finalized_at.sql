-- إضافة حقل finalized_at إلى committee_queue
alter table public.committee_queue
    add column if not exists finalized_at timestamptz;

notify pgrst, 'reload schema';
