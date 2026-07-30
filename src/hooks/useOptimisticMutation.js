import { useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { withRetry } from '../utils/retry.js';

/**
 * useOptimisticMutation — تنفيذ التفاؤلي مع التراجع التلقائي عند الفشل.
 *
 * @param {Object} options
 * @param {Function} options.mutate     — (snapshot) => supabase Promise
 * @param {Function} options.onRollback — (snapshot) => استعادة الحالة السابقة
 * @param {Function} [options.onSuccess] — (result, snapshot) => تحديث إضافي بعد النجاح
 * @param {string}   [options.errorMsg]  — رسالة خطأ مخصصة
 */
export function useOptimisticMutation({ mutate, onRollback, onSuccess, errorMsg }) {
  const [loading, setLoading] = useState(false);
  const snapshotRef = useRef(null);

  const execute = async (snapshot) => {
    snapshotRef.current = snapshot;
    setLoading(true);
    try {
      const result = await withRetry(() => mutate(snapshot));
      if (onSuccess) onSuccess(result, snapshot);
      setLoading(false);
      return { ok: true, data: result };
    } catch (err) {
      onRollback(snapshot);
      setLoading(false);
      return { ok: false, error: err };
    }
  };

  return { execute, loading };
}
