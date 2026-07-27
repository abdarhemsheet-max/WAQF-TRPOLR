import { ar } from '../utils/numbers.js';

/** البطاقات الإحصائية — كل الأرقام تمر عبر ar() التزاماً بقاعدة "عشرة" */
export default function StatsGrid({ students }) {
  const total = students.length;
  const completed = students.filter((s) => Number(s.progress) === 100).length;
  const inProgress = total - completed;

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <span className="label">الطلاب المعروضين</span>
        <span className="value">{ar(total)}</span>
      </div>
      <div className="stat-card">
        <span className="label">أتموا المتن (100%)</span>
        <span className="value" style={{ color: 'var(--success)' }}>{ar(completed)}</span>
      </div>
      <div className="stat-card">
        <span className="label">قيد الحفظ والمراجعة</span>
        <span className="value" style={{ color: 'var(--warning)' }}>{ar(inProgress)}</span>
      </div>
    </div>
  );
}
