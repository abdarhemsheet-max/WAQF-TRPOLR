import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { writeWithFallback } from '../lib/offlineQueue.js';

const SELECT = '*, teacher:users!students_teacher_id_fkey(id, name, halaqa_number)';

/**
 * جلب الطلاب وإدارتهم.
 * teacherId = null  ->  كل طلاب النظام (الأدمن)
 * teacherId = uuid  ->  طلاب هذا المحفّظ فقط
 */
export function useStudents(teacherId = null) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [sortAsc, setSortAsc] = useState(true);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    let request = supabase.from('students').select(SELECT).order('student_number');
    if (teacherId) request = request.eq('teacher_id', teacherId);

    const { data, error: dbError } = await request;
    if (dbError) setError('تعذّر جلب البيانات: ' + dbError.message);
    else {
      setError('');
      setStudents(data ?? []);
    }
    setLoading(false);
  }, [teacherId]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  /**
   * البث اللحظي: عند عمل عدة مستخدمين معاً، تعديل أحدهم يصل للبقية
   * بلا إعادة تحميل. مع كتم متتالٍ (debounce) حتى لا تُرهق موجة تعديلات
   * من عشرين مستخدماً الواجهة بإعادة جلب متكررة.
   */
  useEffect(() => {
    const channel = supabase.channel('students-live');
    let timer = null;

    // لا نُحدّث الجدول والمستخدم يكتب داخله، وإلا اختفى ما يكتبه تحت يده
    const isEditing = () =>
      Boolean(document.activeElement?.closest?.('#studentsTable input'));

    const scheduleRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (isEditing()) return scheduleRefresh();
        fetchStudents();
      }, 800);
    };

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, scheduleRefresh)
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [fetchStudents]);

  /**
   * محرك البحث: يفلتر باسم الطالب واسم المحفّظ — لا شيء غيرهما.
   */
  const filtered = useMemo(() => {
    let list = students;

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.teacher?.name ?? '').toLowerCase().includes(q)
      );
    }

    if (levelFilter) {
      list = list.filter((s) => s.level === levelFilter);
    }

    return [...list].sort((a, b) =>
      sortAsc ? Number(a.progress) - Number(b.progress) : Number(b.progress) - Number(a.progress)
    );
  }, [students, query, levelFilter, sortAsc]);

  const toggleSort = useCallback(() => setSortAsc((v) => !v), []);

  /** تحديث الملاحظة محلياً أثناء الكتابة */
  const changeNote = useCallback((id, value) => {
    setStudents((list) => list.map((s) => (s.id === id ? { ...s, notes: value } : s)));
  }, []);

  /**
   * حفظ الملاحظة في قاعدة البيانات عند مغادرة الحقل.
   * عند انقطاع الشبكة تُحفظ العملية في الطابور المحلي وتُنفَّذ عند عودة الاتصال.
   */
  const commitNote = useCallback(async (id, value) => {
    const { deferred, error: dbError } = await writeWithFallback({
      table: 'students',
      action: 'update',
      payload: { notes: value },
      match: { id }
    });
    if (dbError) setError('تعذّر حفظ الملاحظة: ' + dbError.message);
    else if (deferred) setError('');
  }, []);

  /** تعديل نسبة الإنجاز محلياً أثناء الكتابة في الجدول */
  const changeProgress = useCallback((id, value) => {
    setStudents((list) => list.map((s) => (s.id === id ? { ...s, progress: value } : s)));
  }, []);

  /** تعديل تقييم الصوت محلياً أثناء الكتابة */
  const changeVoiceRating = useCallback((id, value) => {
    setStudents((list) => list.map((s) => (s.id === id ? { ...s, voice_rating: value } : s)));
  }, []);

  /** حفظ تقييم الصوت في قاعدة البيانات مع تثبيته بين 0 و10 */
  const commitVoiceRating = useCallback(async (id, value) => {
    const parsed = Number(value);
    const clamped = Math.min(10, Math.max(0, Number.isNaN(parsed) ? 0 : parsed));

    setStudents((list) => list.map((s) => (s.id === id ? { ...s, voice_rating: clamped } : s)));

    const { error: dbError } = await writeWithFallback({
      table: 'students',
      action: 'update',
      payload: { voice_rating: clamped },
      match: { id }
    });
    if (dbError) setError('تعذّر حفظ تقييم الصوت: ' + dbError.message);
  }, []);

  /** حفظ نسبة الإنجاز في قاعدة البيانات مع تثبيتها بين صفر و100 */
  const commitProgress = useCallback(async (id, value) => {
    const parsed = Number(value);
    const clamped = Math.min(100, Math.max(0, Number.isNaN(parsed) ? 0 : Math.round(parsed)));

    setStudents((list) => list.map((s) => (s.id === id ? { ...s, progress: clamped } : s)));

    const { error: dbError } = await writeWithFallback({
      table: 'students',
      action: 'update',
      payload: { progress: clamped },
      match: { id }
    });
    if (dbError) setError('تعذّر حفظ نسبة الإنجاز: ' + dbError.message);
  }, []);

  const addStudent = useCallback((student) => {
    setStudents((list) => [student, ...list]);
  }, []);

  /** استبدال سجل طالب بعد التعديل */
  const replaceStudent = useCallback((student) => {
    setStudents((list) => list.map((s) => (s.id === student.id ? student : s)));
  }, []);

  /** حذف طالب */
  const deleteStudent = useCallback(async (id, name) => {
    if (!confirm(`هل أنت متأكد من حذف الطالب "${name}"؟`)) return false;
    const { error: dbError } = await supabase.from('students').delete().eq('id', id);
    if (dbError) {
      setError('تعذّر حذف الطالب: ' + dbError.message);
      return false;
    }
    setStudents((list) => list.filter((s) => s.id !== id));
    return true;
  }, []);

  return {
    students,
    visible: filtered,
    loading,
    error,
    query,
    setQuery,
    levelFilter,
    setLevelFilter,
    toggleSort,
    changeNote,
    commitNote,
    changeProgress,
    commitProgress,
    changeVoiceRating,
    commitVoiceRating,
    addStudent,
    replaceStudent,
    deleteStudent,
    refresh: fetchStudents
  };
}
