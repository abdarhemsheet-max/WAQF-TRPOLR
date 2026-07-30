import { useMemo } from 'react';
import { ar } from '../utils/numbers.js';

export default function FinalsStats({ committees }) {
  const stats = useMemo(() => {
    const allQueue = committees.flatMap(c => c.queue || []);
    const allEvals = allQueue.flatMap(q => q.evaluations || []);
    const total = allQueue.length;
    const evaluated = allQueue.filter(q => (q.evaluations?.length || 0) >= 1).length;
    const finalized = allQueue.filter(q => q.status === 'finalized').length;
    const avg = allEvals.length > 0
      ? Math.round(allEvals.reduce((s, e) => s + e.final_score, 0) / allEvals.length)
      : null;

    const perCommittee = committees.map(c => {
      const qs = c.queue || [];
      const evals = qs.flatMap(q => q.evaluations || []);
      const cAvg = evals.length > 0
        ? Math.round(evals.reduce((s, e) => s + e.final_score, 0) / evals.length)
        : null;
      return {
        name: c.name,
        room: c.room,
        total: qs.length,
        evaluated: qs.filter(q => (q.evaluations?.length || 0) >= 1).length,
        finalized: qs.filter(q => q.status === 'finalized').length,
        avg: cAvg,
        members: c.members || []
      };
    });

    return { total, evaluated, finalized, avg, perCommittee };
  }, [committees]);

  if (!committees || committees.length === 0) return null;

  return (
    <div className="glass-panel" style={{ marginBottom: 24 }}>
      <div className="glass-panel-head">
        <h2>إحصائيات التصفيات</h2>
        <span className="glass-panel-hint">
          {ar(committees.length)} {committees.length === 1 ? 'لجنة' : 'لجان'}
        </span>
      </div>

      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <span className="label">إجمالي الطلاب في الطابور</span>
          <span className="value">{ar(stats.total)}</span>
        </div>
        <div className="stat-card">
          <span className="label">تم تقييمهم</span>
          <span className="value" style={{ color: 'var(--primary)' }}>{ar(stats.evaluated)}</span>
        </div>
        <div className="stat-card">
          <span className="label">معتمدون</span>
          <span className="value" style={{ color: 'var(--success)' }}>{ar(stats.finalized)}</span>
        </div>
        <div className="stat-card">
          <span className="label">متوسط النتيجة</span>
          <span className="value" style={{
            color: stats.avg >= 80 ? 'var(--success)' : stats.avg >= 60 ? 'var(--warning)' : 'var(--danger)'
          }}>
            {stats.avg !== null ? `${ar(stats.avg)}%` : '—'}
          </span>
        </div>
      </div>

      {stats.perCommittee.length > 1 && (
        <div className="table-container">
          <table style={{ fontSize: '0.82rem' }}>
            <thead>
              <tr>
                <th>اللجنة</th>
                <th>الغرفة</th>
                <th>الأعضاء</th>
                <th>الطلاب</th>
                <th>مقيّم</th>
                <th>معتمد</th>
                <th>متوسط النتيجة</th>
              </tr>
            </thead>
            <tbody>
              {stats.perCommittee.map(c => (
                <tr key={c.name}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{c.room || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {c.members.map((m, i) => (
                        <span key={m.id || i} className="teacher-badge" style={{
                          background: m.is_head ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.12)',
                          borderColor: m.is_head ? 'rgba(245,158,11,0.35)' : 'rgba(59,130,246,0.3)',
                          color: m.is_head ? '#fcd34d' : '#93c5fd',
                          fontSize: '0.72rem', padding: '2px 8px'
                        }}>
                          {m.teacher_name || m.name} {m.is_head ? '⭐' : ''}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{ar(c.total)}</td>
                  <td style={{ color: 'var(--primary)' }}>{ar(c.evaluated)}</td>
                  <td style={{ color: 'var(--success)' }}>{ar(c.finalized)}</td>
                  <td>
                    {c.avg !== null ? (
                      <strong style={{
                        color: c.avg >= 80 ? 'var(--success)' : c.avg >= 60 ? 'var(--warning)' : 'var(--danger)'
                      }}>{ar(c.avg)}%</strong>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
