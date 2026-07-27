import { ar } from './numbers.js';
import { normalizeGuardianPhone } from './phone.js';
import { OFFICIAL_TEMPLATE_BODY, renderTemplate } from './templates.js';

/**
 * رسالة ولي الأمر بالصيغة الرسمية.
 * تُبنى من القالب الرسمي في templates.js — مصدر واحد لا غير،
 * فلا يمكن أن تتباعد الصيغة المكتوبة في الكود عن القالب المحفوظ في قاعدة البيانات.
 */
export function buildGuardianMessage(student) {
  return renderTemplate(OFFICIAL_TEMPLATE_BODY, student);
}

/**
 * رابط واتساب موجّه إلى رقم ولي الأمر مباشرة.
 * إن كان السجل بلا رقم (سجلات قديمة) يُفتح منتقي جهات الاتصال بدل الفشل.
 */
export function guardianLink(student, body = OFFICIAL_TEMPLATE_BODY) {
  const phone = normalizeGuardianPhone(student.guardian_phone);
  const text = encodeURIComponent(renderTemplate(body, student));
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}

/**
 * فتح محادثة واتساب. يعيد مرجع النافذة، أو null إذا حجبها المتصفح.
 * هذا هو الفشل الحقيقي الوحيد القابل للقياس في هذه القناة:
 * فتح المحادثة لا يعني أن الرسالة أُرسلت — الإرسال يتم بضغطة المستخدم داخل واتساب.
 */
export function openGuardianWhatsapp(student, body = OFFICIAL_TEMPLATE_BODY) {
  return window.open(guardianLink(student, body), '_blank');
}

/** عدد الطلاب بلا رقم ولي أمر — يُستخدم في التنبيهات قبل المراسلة الجماعية */
export function countMissingPhones(students) {
  return students.filter((s) => !normalizeGuardianPhone(s.guardian_phone)).length;
}

/** نص تنبيه موحّد قبل بدء المراسلة الجماعية */
export function massMessagingWarning(students) {
  const missing = countMissingPhones(students);
  return (
    `سيتم فتح محادثة واتساب لكل طالب من ${ar(students.length)} طلاب، بفاصل زمني بينها.\n` +
    'يجب السماح بالنوافذ المنبثقة (Pop-ups) من أعلى المتصفح، وإلا حُجبت المحادثات.\n' +
    'تنبيه: فتح المحادثة لا يُرسل الرسالة — عليك الضغط على «إرسال» داخل واتساب لكل ولي أمر.' +
    (missing ? `\n${ar(missing)} من الطلاب بلا رقم ولي أمر وستُفتح بلا جهة اتصال محددة.` : '')
  );
}
