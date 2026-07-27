import { createClient } from '@supabase/supabase-js';
import { mockClient } from './mockClient.js';

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
