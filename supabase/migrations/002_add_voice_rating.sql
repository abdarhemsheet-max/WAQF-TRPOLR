-- إضافة عمود تقييم الصوت لجدول الطلاب
-- شغّل هذا الملف في Supabase Studio > SQL Editor

alter table public.students
  add column if not exists voice_rating numeric(3,1) not null default 0;
