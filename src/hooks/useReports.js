import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

/**
 * تقارير المراسلة الجماعية المؤرشفة.
 * teacherId = null للأدمن (كل التقارير)، أو معرّف المحفّظ لتقاريره وحده.
 */
export function useReports(teacherId = null) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    let request = supabase.from('message_reports').select('*').order('created_at', {
      ascending: false
    });
    if (teacherId) request = request.eq('teacher_id', teacherId);

    const { data, error: dbError } = await request;
    if (dbError) setError('تعذّر جلب التقارير: ' + dbError.message);
    else {
      setError('');
      setReports(data ?? []);
    }
    setLoading(false);
  }, [teacherId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  /**
   * إحصائيات المراسلة.
   * openRate = نسبة المحادثات التي فتحها المتصفح فعلاً من إجمالي المستلمين.
   * ليست نسبة وصول رسائل — القناة يدوية ولا تعيد إشعار تسليم.
   */
  const stats = useMemo(() => {
    const runs = reports.length;
    const total = reports.reduce((sum, r) => sum + (r.total_count ?? 0), 0);
    const opened = reports.reduce((sum, r) => sum + (r.opened_count ?? 0), 0);
    const blocked = reports.reduce((sum, r) => sum + (r.blocked_count ?? 0), 0);
    const openRate = total ? Math.round((opened / total) * 100) : 0;

    return { runs, total, opened, blocked, openRate };
  }, [reports]);

  return { reports, stats, loading, error, refresh: fetchReports };
}
