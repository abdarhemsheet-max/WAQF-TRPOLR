const CRITERIA = ['لحن', 'تنبيه', 'تلعثم'];

export const DEDUCTIONS = { لحن: 2, تنبيه: 1, تلعثم: 0.5 };

function computeRowScore(row) {
  let d = 0;
  if (row.لحن) d += DEDUCTIONS.لحن;
  if (row.تنبيه) d += DEDUCTIONS.تنبيه;
  if (row.تلعثم) d += DEDUCTIONS.تلعثم;
  return d;
}

export function computeTotalScore(checks, subjects) {
  let totalDeduction = 0;
  for (const subject of subjects) {
    for (const row of checks[subject] || []) {
      totalDeduction += computeRowScore(row);
    }
  }
  return Math.max(0, Math.round((100 - totalDeduction) * 100) / 100);
}

const ROWS_LABELS = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'عشرة'];

const LEVELS_CONFIG = {
  'التمهيدي': { label: 'المستوى التمهيدي', subjects: ['النزهة', 'اللامية', 'الأربعون', 'المختار', 'التحفة', 'الأرجوزة', 'الآجرومية'], rowCount: 10 },
  'الأول': { label: 'المستوى الأول', subjects: ['النزهة', 'الحائية', 'الأربعون', 'المختار', 'التحفة', 'الأرجوزة', 'الروضة', 'الآجرومية'], rowCount: 10 },
  'الثاني': { label: 'المستوى الثاني', subjects: ['النزهة', 'القيروانية', 'الأربعون', 'المختار', 'التحفة', 'الأرجوزة', 'الروضة', 'الآجرومية', 'التائية'], rowCount: 10 },
  'الثالث': { label: 'المستوى الثالث', subjects: ['النزهة', 'القيروانية', 'الأربعون', 'المختار', 'الجزرية', 'التائية', 'الروضة', 'الآجرومية'], rowCount: 10 }
};

export function getLevelConfig(level) {
  return LEVELS_CONFIG[level] ?? LEVELS_CONFIG['التمهيدي'];
}

export function emptyEvaluation(level) {
  const config = getLevelConfig(level);
  const data = {};
  for (const subject of config.subjects) {
    data[subject] = [];
    for (let i = 0; i < config.rowCount; i++) {
      data[subject].push({ لحن: false, تنبيه: false, تلعثم: false });
    }
  }
  return data;
}

export { CRITERIA, ROWS_LABELS };
