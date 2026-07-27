-- إضافة عمود مركز التحفيظ لجدول الطلاب
-- شغّل هذا الملف في Supabase Studio > SQL Editor

alter table public.students
  add column if not exists memorization_center text not null default '';
