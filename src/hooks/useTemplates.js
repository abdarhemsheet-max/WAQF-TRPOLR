import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

/**
 * قوالب الرسائل المتاحة للمستخدم الحالي:
 * القالب الرسمي (teacher_id = null) + القوالب التي أنشأها هو.
 */
export function useTemplates(user) {
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState('');

  const fetchTemplates = useCallback(async () => {
    const { data, error: dbError } = await supabase
      .from('message_templates')
      .select('*')
      .order('created_at');

    if (dbError) {
      setError('تعذّر جلب القوالب: ' + dbError.message);
      return;
    }

    setError('');
    const mine = (data ?? []).filter((t) => !t.teacher_id || t.teacher_id === user.id);
    // القالب الرسمي أولاً دائماً
    setTemplates(mine.sort((a, b) => Number(b.is_locked) - Number(a.is_locked)));
  }, [user.id]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return { templates, error, refresh: fetchTemplates };
}
