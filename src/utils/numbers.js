/**
 * قاعدة ثابتة في جميع نصوص النظام:
 * الأرقام تُكتب كلمات عربية وليس أرقاماً إطلاقاً.
 *
 * تُستخدم هذه الدالة في كل مكان يظهر فيه رقم للمستخدم:
 * الإحصائيات، خلايا الجدول، نِسَب الإنجاز، التنبيهات، ورسائل الواتساب.
 */

const ones = ['صفر', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة',
  'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const hundreds = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

function toArabicWords(n) {
  if (n === 0) return 'صفر';
  if (n < 0) return 'سالب ' + toArabicWords(-n);

  const parts = [];

  if (n >= 1000) {
    const thousands = Math.floor(n / 1000);
    if (thousands === 1) parts.push('ألف');
    else if (thousands === 2) parts.push('ألفان');
    else parts.push(toArabicWords(thousands) + ' آلاف');
    n %= 1000;
  }

  if (n >= 100) {
    const h = Math.floor(n / 100);
    parts.push(hundreds[h]);
    n %= 100;
  }

  if (n >= 20) {
    const t = Math.floor(n / 10);
    parts.push(tens[t]);
    n %= 10;
  }

  if (n > 0) {
    if (n === 2 && parts.length === 0) parts.push('اثنان');
    else parts.push(ones[n]);
  }

  return parts.join(' و ');
}

export function ar(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return String(value ?? '');
  return toArabicWords(n);
}

/** نسبة مئوية بصيغة النظام مثلاً: "خمسون%" */
export function arPercent(value) {
  return `${ar(value)}%`;
}
