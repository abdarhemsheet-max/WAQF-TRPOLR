-- ============================================================
--  إضافة دعم اللجان ذات المحكم المنفرد
--  شغّل هذا الملف في: Supabase Studio > SQL Editor
-- ============================================================

alter table public.committees
    add column if not exists is_single_judge boolean not null default false;

notify pgrst, 'reload schema';
