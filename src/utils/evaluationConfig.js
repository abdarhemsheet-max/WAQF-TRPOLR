const CRITERIA = ['لحن', 'تلعثم', 'تنبيه'];
const ROWS = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'عشرة'];

const LEVELS_CONFIG = {
  'التمهيدي': { label: 'المستوى التمهيدي', subjects: ['النزهة', 'اللامية', 'الأربعون', 'المختار', 'التحفة', 'الأرجوزة', 'الآجرومية'], rowCount: 10 },
  'الأول': { label: 'المستوى الأول', subjects: ['النزهة', 'الحائية', 'الأربعون', 'المختار', 'التحفة', 'الأرجوزة', 'الروضة', 'الآجرومية'], rowCount: 10 },
  'الثاني': { label: 'المستوى الثاني', subjects: ['النزهة', 'القيروانية', 'الأربعون', 'المختار', 'التحفة', 'الأرجوزة', 'الروضة', 'الآجرومية', 'التائية'], rowCount: 10 },
  'الثالث': { label: 'المستوى الثالث', subjects: ['النزهة', 'القيروانية', 'الأربعون', 'المختار', 'الجزرية', 'التائية', 'الروضة', 'الآجرومية'], rowCount: 10 }
};

export function getLevelConfig(level) {
  return LEVELS_CONFIG[level] ?? LEVELS_CONFIG['التمهيدي'];
}

export function getTotalColumns(level) {
  const config = getLevelConfig(level);
  return config.subjects.length * CRITERIA.length;
}

export function emptyEvaluation(level) {
  const config = getLevelConfig(level);
  const data = {};
  for (const subject of config.subjects) {
    data[subject] = [];
    for (let i = 0; i < config.rowCount; i++) {
      data[subject].push({ لحن: false, تلعثم: false, تنبيه: false });
    }
  }
  return data;
}

export { CRITERIA, ROWS };
