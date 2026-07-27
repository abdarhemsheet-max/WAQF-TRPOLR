/** المستويات والمتون المقررة لكل مستوى */
export const LEVELS = [
  { level: 'التمهيدي', matn: 'متن تحفة الأطفال' },
  { level: 'الأول', matn: 'متن الجزرية' },
  { level: 'الثاني', matn: 'متن الشاطبية' },
  { level: 'الثالث', matn: 'متن الدرة' }
];

export function matnForLevel(level) {
  return LEVELS.find((l) => l.level === level)?.matn ?? '';
}

export function progressColor(progress) {
  const p = Number(progress);
  if (p === 100) return 'var(--success)';
  if (p >= 50) return 'var(--primary)';
  return 'var(--danger)';
}
