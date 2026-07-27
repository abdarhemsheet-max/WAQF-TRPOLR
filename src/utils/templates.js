import { ar } from './numbers.js';

/**
 * المتغيّرات الديناميكية المتاحة في القوالب.
 * كل متغيّر يُستبدل ببيانات الطالب الفعلية من Supabase عند الإرسال.
 */
export const TEMPLATE_VARIABLES = [
  { token: '{اسم_الطالب}', label: 'اسم الطالب', resolve: (s) => s.name ?? '' },
  { token: '{المستوى}', label: 'المستوى', resolve: (s) => s.level ?? '' },
  { token: '{النسبة}', label: 'نسبة الإنجاز', resolve: (s) => ar(s.progress) },
  { token: '{المتن}', label: 'المتن', resolve: (s) => s.matn ?? '' },
  { token: '{الملاحظة}', label: 'الملاحظة', resolve: (s) => String(s.notes ?? '').trim() },
  { token: '{المحفظ}', label: 'اسم المحفّظ', resolve: (s) => s.teacher?.name ?? '' },
  { token: '{الحلقة}', label: 'رمز الحلقة', resolve: (s) => s.teacher?.halaqa_number ?? '' }
];

/**
 * القالب الرسمي المعتمد — المصدر الوحيد لهذه الصيغة في النظام كله.
 * لا يجوز تعديل أسطره ولا إضافة أي نص إليها.
 * سطر {الملاحظة} يسقط تلقائياً إذا لم تكن هناك ملاحظة.
 */
export const OFFICIAL_TEMPLATE_NAME = 'الصيغة الرسمية المعتمدة';

export const OFFICIAL_TEMPLATE_BODY = [
  'مكتب أوقاف طرابلس المركز قسم شؤون القران الكريم والسنة النبوية',
  'ملخص إنجاز الطالب :',
  '{اسم_الطالب}',
  'المستوى: {المستوى}',
  'نسبة الإنجاز : {النسبة}% من المستوى {المستوى}.',
  '{الملاحظة}'
].join('\n');

function substitute(line, student) {
  let out = line;
  for (const variable of TEMPLATE_VARIABLES) {
    if (out.includes(variable.token)) {
      out = out.split(variable.token).join(variable.resolve(student));
    }
  }
  return out;
}

/**
 * استبدال المتغيّرات ببيانات الطالب.
 * أي سطر يتكوّن من متغيّرات فقط ويأتي فارغاً بعد الاستبدال يُحذف من الرسالة
 * (وهذا ما يجعل سطر الملاحظة يظهر عند وجودها فقط).
 */
export function renderTemplate(body, student) {
  const lines = String(body ?? '').split('\n');
  const rendered = [];

  for (const line of lines) {
    const hadVariable = TEMPLATE_VARIABLES.some((v) => line.includes(v.token));
    const value = substitute(line, student);
    if (hadVariable && value.trim() === '') continue;
    rendered.push(value);
  }

  return rendered.join('\n');
}

/** قائمة المتغيّرات المستخدمة فعلياً في نص قالب */
export function usedVariables(body) {
  return TEMPLATE_VARIABLES.filter((v) => String(body ?? '').includes(v.token));
}

/** طالب وهمي لمعاينة القالب قبل الحفظ */
export const PREVIEW_STUDENT = {
  name: 'أحمد محمود',
  level: 'الأول',
  progress: 50,
  matn: 'متن الجزرية',
  notes: 'مثال على ملاحظة',
  teacher: { name: 'عبدالرحمن الشمري', halaqa_number: 'الأولى' }
};
