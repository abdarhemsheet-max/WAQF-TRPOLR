import { OFFICIAL_TEMPLATE_BODY, OFFICIAL_TEMPLATE_NAME } from '../utils/templates.js';

/**
 * بيانات الوضع التجريبي — تُحفظ في localStorage داخل متصفحك فقط.
 * لا علاقة لها بقاعدة بيانات Supabase إطلاقاً.
 */

const STORAGE_KEY = 'waqf.demo.db';

const ADMIN_ID = 'demo-admin-0001';
const T1 = 'demo-teacher-0001';
const T2 = 'demo-teacher-0002';

const SEED_USERS = [
  { id: ADMIN_ID, name: 'عبدالمجيد', role: 'admin', passcode: '20262026', halaqa_number: null },
  { id: T1, name: 'عبدالرحمن الشمري', role: 'teacher', passcode: 'T-101', halaqa_number: 'الأولى' },
  { id: T2, name: 'سعد الحربي', role: 'teacher', passcode: 'T-102', halaqa_number: 'الثانية' }
];

// عشرة طلاب للحلقة الأولى (نفس بيانات التصميم الأساسي)
const SEED_STUDENTS = [
  { student_number: '2001', name: 'أحمد محمود',    level: 'التمهيدي', matn: 'متن تحفة الأطفال', progress: 50,  notes: '',                      guardian_phone: '218912345601', teacher_id: T1 },
  { student_number: '2002', name: 'سالم علي',      level: 'الأول',    matn: 'متن الجزرية',      progress: 16,  notes: 'يحتاج لمراجعة المخارج', guardian_phone: '218912345602', teacher_id: T1 },
  { student_number: '2003', name: 'عمر خالد',      level: 'الثاني',   matn: 'متن الشاطبية',     progress: 20,  notes: '',                      guardian_phone: '218912345603', teacher_id: T1 },
  { student_number: '2004', name: 'محمد فرج',      level: 'الثالث',   matn: 'متن الدرة',        progress: 100, notes: 'ممتاز جداً',            guardian_phone: '218912345604', teacher_id: T1 },
  { student_number: '2005', name: 'عبدالله حسن',   level: 'الأول',    matn: 'متن الجزرية',      progress: 50,  notes: '',                      guardian_phone: '218912345605', teacher_id: T1 },
  { student_number: '2006', name: 'يوسف إبراهيم',  level: 'التمهيدي', matn: 'متن تحفة الأطفال', progress: 20,  notes: '',                      guardian_phone: '218912345606', teacher_id: T1 },
  { student_number: '2007', name: 'طارق زياد',     level: 'الثاني',   matn: 'متن الشاطبية',     progress: 16,  notes: 'غائب الأسبوع الماضي',   guardian_phone: '218912345607', teacher_id: T1 },
  { student_number: '2008', name: 'أيمن سعد',      level: 'الأول',    matn: 'متن الجزرية',      progress: 100, notes: '',                      guardian_phone: '218912345608', teacher_id: T1 },
  { student_number: '2009', name: 'خالد وليد',     level: 'التمهيدي', matn: 'متن تحفة الأطفال', progress: 16,  notes: '',                      guardian_phone: '218912345609', teacher_id: T1 },
  { student_number: '2011', name: 'مروان سعيد',    level: 'الثالث',   matn: 'متن الدرة',        progress: 50,  notes: '',                      guardian_phone: '218912345611', teacher_id: T1 },
  // الحلقة الثانية
  { student_number: '3001', name: 'بدر ناصر',      level: 'الأول',    matn: 'متن الجزرية',      progress: 100, notes: 'أتم المتن كاملاً',      guardian_phone: '218913450001', teacher_id: T2 },
  { student_number: '3002', name: 'ريان مشعل',     level: 'التمهيدي', matn: 'متن تحفة الأطفال', progress: 20,  notes: '',                      guardian_phone: '218913450002', teacher_id: T2 },
  { student_number: '3003', name: 'فهد العتيبي',   level: 'الثاني',   matn: 'متن الشاطبية',     progress: 50,  notes: '',                      guardian_phone: '218913450003', teacher_id: T2 },
  { student_number: '3004', name: 'ماجد الدوسري',  level: 'الثالث',   matn: 'متن الدرة',        progress: 16,  notes: 'بداية موفقة',           guardian_phone: '218913450004', teacher_id: T2 }
];

function buildSeed() {
  const now = new Date().toISOString();
  return {
    users: SEED_USERS.map((u) => ({ ...u, created_at: now })),
    students: SEED_STUDENTS.map((s, i) => ({
      ...s,
      id: `demo-student-${String(i + 1).padStart(4, '0')}`,
      created_at: now,
      updated_at: now
    })),
    message_templates: [
      {
        id: 'demo-template-official',
        name: OFFICIAL_TEMPLATE_NAME,
        body: OFFICIAL_TEMPLATE_BODY,
        is_locked: true,
        teacher_id: null,
        created_at: now
      }
    ],
    message_reports: []
  };
}

/** الجداول التي أُضيفت بعد أول إصدار — تُستكمل لقواعد محفوظة سابقاً */
function migrate(db) {
  const seed = buildSeed();
  let changed = false;

  for (const table of ['message_templates', 'message_reports']) {
    if (!Array.isArray(db[table])) {
      db[table] = seed[table];
      changed = true;
    }
  }

  // القالب الرسمي مصدره الكود: نُبقيه متطابقاً دائماً
  const official = db.message_templates.find((t) => t.is_locked);
  if (!official) {
    db.message_templates.unshift(seed.message_templates[0]);
    changed = true;
  } else if (official.body !== OFFICIAL_TEMPLATE_BODY) {
    official.body = OFFICIAL_TEMPLATE_BODY;
    official.name = OFFICIAL_TEMPLATE_NAME;
    changed = true;
  }

  if (changed) saveDemoDb(db);
  return db;
}

export function loadDemoDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.users?.length && Array.isArray(parsed.students)) return migrate(parsed);
    }
  } catch {
    /* بيانات تالفة — نعيد البذرة */
  }
  const seed = buildSeed();
  saveDemoDb(seed);
  return seed;
}

export function saveDemoDb(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

/** إعادة البيانات التجريبية إلى حالتها الأصلية */
export function resetDemoDb() {
  localStorage.removeItem(STORAGE_KEY);
  return loadDemoDb();
}

export const DEMO_ACCOUNTS = [
  { role: 'أدمن', name: 'عبدالمجيد', passcode: '20262026' },
  { role: 'محفّظ', name: 'عبدالرحمن الشمري', passcode: 'T-101' },
  { role: 'محفّظ', name: 'سعد الحربي', passcode: 'T-102' }
];
