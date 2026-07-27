/**
 * تطبيع رقم ولي الأمر إلى الصيغة الدولية التي يقبلها رابط واتساب:
 * أرقام فقط، بلا + وبلا صفر بادئ.
 *
 * غيّر DEFAULT_COUNTRY_CODE إن كان النظام يُستخدم خارج ليبيا.
 */
export const DEFAULT_COUNTRY_CODE = '218'; // ليبيا

export function normalizeGuardianPhone(raw) {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';

  // 00218... → 218...
  if (digits.startsWith('00')) digits = digits.slice(2);

  // مكتوب أصلاً بالصيغة الدولية
  if (digits.startsWith(DEFAULT_COUNTRY_CODE)) return digits;

  // 0912345678 → 218912345678
  if (digits.startsWith('0')) return DEFAULT_COUNTRY_CODE + digits.slice(1);

  return DEFAULT_COUNTRY_CODE + digits;
}

/** تحقق مبدئي من طول الرقم قبل الحفظ */
export function isValidGuardianPhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length < 9) return false;

  const normalized = normalizeGuardianPhone(raw);
  return normalized.length >= 11 && normalized.length <= 15;
}

/** عرض الرقم بصيغة قابلة للقراءة: +218912345678 */
export function displayGuardianPhone(raw) {
  const normalized = normalizeGuardianPhone(raw);
  return normalized ? `+${normalized}` : '';
}
