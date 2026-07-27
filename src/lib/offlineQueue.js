import { supabase } from './supabaseClient.js';

/**
 * طابور العمليات المؤجَّلة عند انقطاع الإنترنت.
 *
 * أي كتابة تفشل بسبب الشبكة تُحفظ في localStorage بصيغة عامة
 * ({table, action, payload}) ثم تُنفَّذ تلقائياً على Supabase بمجرد عودة الاتصال.
 */

const KEY = 'waqf.offline.queue';
const MAX_ATTEMPTS = 5;

const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(queue) {
  localStorage.setItem(KEY, JSON.stringify(queue));
  listeners.forEach((fn) => fn(queue));
}

/** الاشتراك في تغيّرات الطابور (لعرض العدّاد في الواجهة) */
export function subscribeQueue(listener) {
  listeners.add(listener);
  listener(load());
  return () => listeners.delete(listener);
}

export function pendingOperations() {
  return load();
}

export function enqueue(operation) {
  const queue = load();
  queue.push({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    attempts: 0,
    ...operation
  });
  save(queue);
}

/** هل يبدو هذا الخطأ خطأ شبكة يستحق التأجيل؟ */
function isNetworkError(error) {
  if (!error) return false;
  const message = String(error.message ?? error).toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed') ||
    message.includes('timeout') ||
    message.includes('offline')
  );
}

async function execute(operation) {
  const { table, action, payload, match } = operation;

  if (action === 'insert') {
    return supabase.from(table).insert(payload);
  }
  if (action === 'update') {
    return supabase.from(table).update(payload).eq('id', match.id);
  }
  throw new Error(`عملية غير مدعومة في الطابور: ${action}`);
}

/**
 * تنفيذ كتابة مع تأجيل تلقائي عند انقطاع الشبكة.
 * يعيد { deferred: true } إذا حُفظت العملية في الطابور بدل تنفيذها.
 */
export async function writeWithFallback(operation) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    enqueue(operation);
    return { deferred: true, error: null };
  }

  try {
    const { error } = await execute(operation);
    if (error && isNetworkError(error)) {
      enqueue(operation);
      return { deferred: true, error: null };
    }
    return { deferred: false, error: error ?? null };
  } catch (thrown) {
    if (isNetworkError(thrown)) {
      enqueue(operation);
      return { deferred: true, error: null };
    }
    return { deferred: false, error: { message: String(thrown.message ?? thrown) } };
  }
}

/**
 * مزامنة الطابور مع Supabase.
 * العمليات التي تفشل لسبب غير شبكي تُسقَط بعد MAX_ATTEMPTS محاولات
 * حتى لا يتعطّل الطابور على عملية فاسدة إلى الأبد.
 */
export async function flushQueue() {
  const queue = load();
  if (!queue.length) return { synced: 0, dropped: 0, remaining: 0 };

  const remaining = [];
  let synced = 0;
  let dropped = 0;

  for (const operation of queue) {
    try {
      const { error } = await execute(operation);
      if (error) throw new Error(error.message);
      synced++;
    } catch (thrown) {
      const attempts = (operation.attempts ?? 0) + 1;
      if (isNetworkError(thrown) || attempts < MAX_ATTEMPTS) {
        remaining.push({ ...operation, attempts, lastError: String(thrown.message ?? thrown) });
      } else {
        dropped++;
      }
    }
  }

  save(remaining);
  return { synced, dropped, remaining: remaining.length };
}

/** تشغيل المزامنة تلقائياً عند عودة الاتصال ومرة عند الإقلاع */
export function startAutoSync() {
  const trigger = () => {
    if (navigator.onLine) flushQueue();
  };

  window.addEventListener('online', trigger);
  trigger();

  return () => window.removeEventListener('online', trigger);
}
