import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useStudents } from '../hooks/useStudents.js';
import { useReports } from '../hooks/useReports.js';
import { ar, arPercent } from '../utils/numbers.js';
import { progressColor } from '../utils/levels.js';
import TopBar from '../components/TopBar.jsx';

const TOP_COUNT = 10;

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ar-EG', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

/** لوحة التحكم الإحصائية — زجاج سائل على خلفية داكنة */
export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const scope = isAdmin ? null : user.id;

  const { students, loading: loadingStudents } = useStudents(scope);
  const { reports, stats, loading: loadingReports } = useReports(scope);

  const summary = useMemo(() => {
    const total = students.length;
    const completed = students.filter((s) => Number(s.progress) === 100).length;
    const average = total
      ? Math.round(students.reduce((sum, s) => sum + (Number(s.progress) || 0), 0) / total)
      : 0;
    const withoutPhone = students.filter((s) => !String(s.guardian_phone ?? '').trim()).length;

    return { total, completed, average, withoutPhone };
  }, [students]);

  /** أفضل عشرة طلاب حسب نسبة الإنجاز */
  const topStudents = useMemo(
    () =>
      [...students]
        .sort((a, b) => Number(b.progress) - Number(a.progress) || a.name.localeCompare(b.name, 'ar'))
        .slice(0, TOP_COUNT),
    [students]
  );

  return (
    <div className="container">
      <TopBar />

      <div className="title" style={{ marginBottom: 24 }}>
        <h1>لوحة التحكم الإحصائية</h1>
        <p>
          {isAdmin ? 'جميع الحلقات' : `الحلقة ${user.halaqa_number}`} — إحصائيات لحظية من قاعدة
          البيانات
        </p>
      </div>

      {/* بطاقات الإحصائيات */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="label">إجمالي الطلاب</span>
          <span className="value">{ar(summary.total)}</span>
        </div>
        <div className="stat-card">
          <span className="label">أتموا المتن</span>
          <span className="value" style={{ color: 'var(--success)' }}>
            {ar(summary.completed)}
          </span>
        </div>
        <div className="stat-card">
          <span className="label">متوسط الإنجاز</span>
          <span className="value" style={{ color: 'var(--primary)' }}>
            {arPercent(summary.average)}
          </span>
        </div>
        <div className="stat-card">
          <span className="label">بلا رقم ولي أمر</span>
          <span className="value" style={{ color: summary.withoutPhone ? 'var(--warning)' : undefined }}>
            {ar(summary.withoutPhone)}
          </span>
        </div>
      </div>

      <div className="dash-grid">
        {/* أفضل عشرة طلاب */}
        <section className="glass-panel">
          <header className="glass-panel-head">
            <h2>أفضل عشرة طلاب</h2>
            <span className="glass-panel-hint">مرتّبون حسب نسبة الإنجاز</span>
          </header>

          {loadingStudents ? (
            <div className="empty-state">جارٍ التحميل...</div>
          ) : topStudents.length ? (
            <ol className="top-list">
              {topStudents.map((student, index) => (
                <li className="top-row" key={student.id}>
                  <span className={`top-rank${index < 3 ? ' medal' : ''}`}>{ar(index + 1)}</span>
                  <div className="top-main">
                    <span className="top-name">{student.name}</span>
                    <span className="top-meta">
                      {student.level}
                      {isAdmin && student.teacher?.name ? ` · ${student.teacher.name}` : ''}
                    </span>
                  </div>
                  <div className="top-progress">
                    <div className="progress-bar-bg">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${Math.min(100, Math.max(0, Number(student.progress) || 0))}%`,
                          background: progressColor(student.progress)
                        }}
                      />
                    </div>
                    <span className="progress-text">{arPercent(student.progress)}</span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty-state">لا يوجد طلاب بعد.</div>
          )}
        </section>

        {/* إحصائيات المراسلة */}
        <section className="glass-panel">
          <header className="glass-panel-head">
            <h2>المراسلة الجماعية</h2>
            <span className="glass-panel-hint">من التقارير المؤرشفة</span>
          </header>

          <div className="dash-metric">
            <span className="dash-metric-label">نسبة فتح المحادثات</span>
            <span className="dash-metric-value" style={{ color: 'var(--primary)' }}>
              {arPercent(stats.openRate)}
            </span>
            <div className="progress-bar-bg">
              <div
                className="progress-bar-fill"
                style={{ width: `${stats.openRate}%`, background: 'var(--primary)' }}
              />
            </div>
            <p className="dash-metric-note">
              تقيس المحادثات التي فتحها المتصفح فعلاً، لا وصول الرسائل — فقناة wa.me
              يدوية ولا تُرجع إشعار تسليم.
            </p>
          </div>

          <div className="dash-mini-grid">
            <div className="dash-mini">
              <span className="label">عمليات إرسال</span>
              <span className="value">{ar(stats.runs)}</span>
            </div>
            <div className="dash-mini">
              <span className="label">مستلمون</span>
              <span className="value">{ar(stats.total)}</span>
            </div>
            <div className="dash-mini">
              <span className="label">فُتحت</span>
              <span className="value" style={{ color: 'var(--success)' }}>
                {ar(stats.opened)}
              </span>
            </div>
            <div className="dash-mini">
              <span className="label">محجوبة</span>
              <span className="value" style={{ color: 'var(--danger)' }}>
                {ar(stats.blocked)}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* سجل العمليات المؤرشفة */}
      <section className="glass-panel" style={{ marginTop: 20 }}>
        <header className="glass-panel-head">
          <h2>سجل عمليات المراسلة</h2>
          <span className="glass-panel-hint">تُؤرشف تلقائياً بعد كل عملية</span>
        </header>

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>المنفّذ</th>
                <th>القالب</th>
                <th>المستلمون</th>
                <th>فُتحت</th>
                <th>محجوبة</th>
              </tr>
            </thead>
            <tbody>
              {reports.slice(0, 15).map((report) => (
                <tr key={report.id}>
                  <td className="student-number">{formatDate(report.created_at)}</td>
                  <td>{report.teacher_name || '—'}</td>
                  <td>
                    <span className="level-badge">{report.template_name || '—'}</span>
                  </td>
                  <td>{ar(report.total_count)}</td>
                  <td style={{ color: 'var(--success)' }}>{ar(report.opened_count)}</td>
                  <td style={{ color: report.blocked_count ? 'var(--danger)' : undefined }}>
                    {ar(report.blocked_count)}
                  </td>
                </tr>
              ))}
              {!loadingReports && !reports.length && (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">لم تُنفَّذ أي عملية مراسلة جماعية بعد.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
