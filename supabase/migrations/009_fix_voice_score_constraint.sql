-- ============================================================
--  رفع قيد voice_score ليستوعب مجموع أسئلة متعددة
-- ============================================================

alter table public.qualification_evaluations
    drop constraint if exists qualification_evaluations_voice_score_check;

alter table public.qualification_evaluations
    add constraint qualification_evaluations_voice_score_check
    check (voice_score >= 0 and voice_score <= 50);

notify pgrst, 'reload schema';
