-- ============================================================
--  تحسين أداء قواعد البيانات: فهارس B-tree للاستعلامات المتكررة
--  شغّل هذا الملف في: Supabase Studio > SQL Editor
-- ============================================================

-- -----------------------------------------------------------
-- 1) فهارس committee_queue
-- -----------------------------------------------------------

-- فهرس مركب committee + status (الاستعلام الأكثر تكراراً للجنة)
create index if not exists cq_committee_status_idx
    on public.committee_queue (committee_id, status);

-- فهرس finals_student_id للربط السريع مع finals_students
create index if not exists cq_finals_student_idx
    on public.committee_queue (finals_student_id);

-- فهرس student_id للربط السريع مع students
create index if not exists cq_student_idx
    on public.committee_queue (student_id);

-- فهرس تنازلي على created_at لترتيب الطابور
create index if not exists cq_created_idx
    on public.committee_queue (created_at desc);

-- فهرس جزئي على finalized_at (للمعتمدين فقط)
create index if not exists cq_finalized_idx
    on public.committee_queue (finalized_at)
    where finalized_at is not null;

-- -----------------------------------------------------------
-- 2) فهارس qualification_evaluations
-- -----------------------------------------------------------

-- فهرس مركب للاستعلام الشائع: التقييمات حسب queue_id + المقيم
create index if not exists qe_queue_evaluator_idx
    on public.qualification_evaluations (queue_id, evaluator_id);

-- فهرس finals_student_id للربط
create index if not exists qe_finals_student_idx
    on public.qualification_evaluations (finals_student_id);

-- فهرس student_id للربط
create index if not exists qe_student_idx
    on public.qualification_evaluations (student_id);

-- فهرس تنازلي على created_at للترتيب
create index if not exists qe_created_idx
    on public.qualification_evaluations (created_at desc);

-- -----------------------------------------------------------
-- 3) فهارس finals_students
-- -----------------------------------------------------------

-- فهرس المستوى لفلترة سريعة
create index if not exists fs_level_idx
    on public.finals_students (level);

-- فهرس المركز لفلترة سريعة
create index if not exists fs_center_idx
    on public.finals_students (memorization_center);

-- فهرس تنازلي على created_at للترتيب
create index if not exists fs_created_idx
    on public.finals_students (created_at desc);

-- -----------------------------------------------------------
-- 4) فهارس committees
-- -----------------------------------------------------------

-- فهرس تنازلي على created_at للترتيب
create index if not exists com_created_idx
    on public.committees (created_at desc);

-- -----------------------------------------------------------
-- 5) فهارس committee_members
-- -----------------------------------------------------------

-- فهرس مركب user + is_head للتحقق السريع من صلاحية الرئيس/العضو
create index if not exists cm_user_head_idx
    on public.committee_members (user_id, is_head);

-- -----------------------------------------------------------
-- 6) إعادة تحميل schema cache
-- -----------------------------------------------------------
notify pgrst, 'reload schema';

-- ============================================================
--  ملخص الفهارس المُنشأة:
--  committee_queue:          5 (3 B-tree + 1 مركب + 1 جزئي)
--  qualification_evaluations: 4 (1 مركب + 3 B-tree)
--  finals_students:          3
--  committees:               1
--  committee_members:        1
--  المجموع:                 14 فهرساً جديداً
-- ============================================================
