/**
 * قاعدة ثابتة في جميع نصوص النظام:
 * الرقم (10) يُكتب دائماً "عشرة" ولا يُكتب كرقم إطلاقاً.
 *
 * تُستخدم هذه الدالة في كل مكان يظهر فيه رقم للمستخدم:
 * الإحصائيات، خلايا الجدول، نِسَب الإنجاز، التنبيهات، ورسائل الواتساب.
 */
export function ar(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return String(value ?? '');
  if (n === 10) return 'عشرة';
  return String(n);
}

/** نسبة مئوية بصيغة النظام: %عشرة أو %50 */
export function arPercent(value) {
  return `%${ar(value)}`;
}
