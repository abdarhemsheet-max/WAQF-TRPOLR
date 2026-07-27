import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * مسار الأساس (base) لازم لـ GitHub Pages.
 * موقع مشروع:      https://<user>.github.io/<repo>/   →  VITE_BASE_PATH=/<repo>/
 * نطاق مخصّص أو موقع مستخدم:                          →  اتركه فارغاً
 */
const base = process.env.VITE_BASE_PATH || '/';

/**
 * ‏GitHub Pages لا يعرف التوجيه من جهة الخادم، فأي تحديث للصفحة على مسار
 * مثل /dashboard يعيد 404. نسخة من index.html باسم 404.html تجعل Pages
 * يعيد التطبيق نفسه فيتولّى React Router المسار.
 */
function spaFallback() {
  return {
    name: 'spa-404-fallback',
    closeBundle() {
      const dist = resolve(process.cwd(), 'dist');
      try {
        writeFileSync(resolve(dist, '404.html'), readFileSync(resolve(dist, 'index.html')));
      } catch {
        /* لا يوجد dist في وضع التطوير */
      }
    }
  };
}

export default defineConfig({
  base,
  plugins: [react(), spaFallback()],
  server: { port: 5173, open: true },
  build: { outDir: 'dist', sourcemap: false }
});
