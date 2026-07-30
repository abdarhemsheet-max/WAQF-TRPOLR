import { createClient } from '@supabase/supabase-js';
import { mockClient } from './mockClient.js';

/**
 * ============================================================
 *  Connection Pooling (تجمع الاتصالات)
 * ============================================================
 * الـ JS client يتصل بـ Supabase عبر API Gateway الذي يدير
 * تجمع الاتصالات تلقائياً — لا حاجة لتعديل.
 *
 * للاتصال المباشر بـ PostgreSQL عبر Transaction Pooler:
 *   VITE_SUPABASE_URL="postgresql://{user}:{pass}@aws-0-{region}.pooler.supabase.com:6543/postgres"
 * وفعّل "Use connection pooler" في Supabase > Settings > Database.
 *
 * ملاحظة: الـ JS client لا يستخدم connection string مباشرةً؛
 * يُستخدم pooler فقط عند الاتصال المباشر (psql، pgAdmin، إلخ).
 * ============================================================
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const configured = Boolean(url && anonKey);
const forcedDemo = import.meta.env.VITE_DEMO === 'true';

/**
 * الوضع التجريبي: بيانات وهمية في متصفحك بلا أي اتصال بقاعدة بيانات.
 * يعمل تلقائياً إذا لم يُضبط ملف .env، أو إجبارياً عبر VITE_DEMO=true
 */
export const isDemo = forcedDemo || !configured;

// المصادقة مخصّصة بالكامل (اسم + رمز دخول) فلا حاجة لجلسات Supabase Auth
export const supabase = isDemo
  ? mockClient
  : createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
