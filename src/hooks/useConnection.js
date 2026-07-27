import { useEffect, useState } from 'react';
import { flushQueue, startAutoSync, subscribeQueue } from '../lib/offlineQueue.js';

/**
 * حالة الاتصال وعدد العمليات المؤجَّلة.
 * يشغّل المزامنة التلقائية مرة واحدة عند إقلاع التطبيق.
 */
export function useConnection() {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    const unsubscribeQueue = subscribeQueue((queue) => setPending(queue.length));
    const stopAutoSync = startAutoSync();

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      unsubscribeQueue();
      stopAutoSync();
    };
  }, []);

  return { online, pending, syncNow: flushQueue };
}
