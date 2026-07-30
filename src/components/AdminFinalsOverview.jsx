import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { ar } from '../utils/numbers.js';

export default function AdminFinalsOverview({ onChanged }) {
  const [committees, setCommittees] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [cRes, mRes, qRes, eRes] = await Promise.all([
      supabase.from('committees').select('*').order('created_at'),
      supabase.from('committee_members').select('*'),
      supabase.from('committee_queue').select('*').order('created_at'),
      supabase.from('qualification_evaluations').select('*')
    ]);
    if (!cRes.data) { setLoading(false); return; }

    const uRes = await supabase.from('users').select('id, name');
    const usersMap = {}; (uRes.data || []).forEach(u => { usersMap[u.id] = u.name; });

    const qItems = qRes.data || [];
    const fsIds = [...new Set(qItems.filter(q => q.finals_student_id).map(q => q.finals_student_id))];
    const regIds = [...new Set(qItems.filter(q => q.student_id).map(q => q.student_id))];

    const [fsRes, sRes] = await Promise.all([
      fsIds.length ? supabase.from('finals_students').select('*') : { data: [] },
      regIds.length ? supabase.from('students').select('id, name') : { data: [] }
    ]);

    const finalsMap = {}; (fsRes.data || []).forEach(f => { finalsMap[f.id] = f; });
    const regMap = {}; (sRes.data || []).forEach(s => { regMap[s.id] = s; });

    const evals = eRes.data || [];

    setCommittees(cRes.data.map(c => {
      const members = (mRes.data || []).filter(m => m.committee_id === c.id).map(m => ({
        ...m, name: usersMap[m.user_id] || ''
      }));
      const queue = qItems.filter(q => q.committee_id === c.id).map(q => {
        const student = q.finals_student_id ? finalsMap[q.finals_student_id] : regMap[q.student_id];
        const evaluations = evals.filter(e => e.queue_id === q.id).map(e => ({
          ...e, evaluator_name: usersMap[e.evaluator_id] || ''
        }));
        return { ...q, student, evaluations };
      });
      return { ...c, members, queue };
    }));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="empty-state">جارٍ تحميل نظرة عامة...</div>;

  return (
    <div className="glass-panel">
      <div className="glass-panel-head">
        <h2>نظرة عامة على لجان التحكيم</h2>
      </div>

      {committees.length === 0 ? (
        <div className="empty-state">لا توجد لجان تحكيم</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {committees.map(c => {
            const pending = c.queue.filter(q => q.status === 'pending');
            const evaluated = c.queue.filter(q => q.status === 'evaluated');
            const head = c.members.find(m => m.is_head);

            return (
              <div key={c.id} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, padding: '16px 20px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  <div>
                    <strong style={{ fontSize: '1rem' }}>{c.name}</strong>
                    {c.room && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginRight: 12 }}>📍 {c.room}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span className="level-badge" style={{ background: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.3)', color: '#fcd34d' }}>
                      {ar(pending.length)} بانتظار
                    </span>
                    <span className="level-badge" style={{ background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.3)', color: '#6ee7b7' }}>
                      {ar(evaluated.length)} تم
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {c.members.map(m => (
                    <span key={m.id} className="teacher-badge" style={{
                      background: m.is_head ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.12)',
                      borderColor: m.is_head ? 'rgba(245,158,11,0.35)' : 'rgba(59,130,246,0.3)',
                      color: m.is_head ? '#fcd34d' : '#93c5fd'
                    }}>{m.name} {m.is_head ? '⭐' : ''}</span>
                  ))}
                </div>

                {c.queue.length > 0 ? (
                  <div className="table-container">
                    <table style={{ fontSize: '0.82rem' }}>
                      <thead>
                        <tr>
                          <th>الطالب</th>
                          <th>الحالة</th>
                          <th>تقييم الأعضاء</th>
                          <th>متوسط النتيجة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.queue.map(q => {
                          const eNames = q.evaluations.map(e => `${e.evaluator_name}: ${ar(Math.round(e.final_score))}%`).join(' | ');
                          const avg = q.evaluations.length > 0
                            ? Math.round(q.evaluations.reduce((s, e) => s + e.final_score, 0) / q.evaluations.length)
                            : null;
                          return (
                            <tr key={q.id}>
                              <td style={{ fontWeight: 600 }}>{q.student?.name || '—'}</td>
                              <td>
                                <span className="level-badge" style={{
                                  background: q.status === 'pending' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
                                  borderColor: q.status === 'pending' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)',
                                  color: q.status === 'pending' ? '#fcd34d' : '#6ee7b7'
                                  }}>{q.status === 'pending' ? 'بانتظار التقييم' : 'تم التقييم'}</span></td>
                              <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                {eNames || '—'}
                              </td>
                              <td>
                                {avg !== null ? (
                                  <strong style={{ color: avg >= 80 ? '#6ee7b7' : avg >= 60 ? '#fcd34d' : '#fca5a5' }}>
                                    {ar(avg)}%
                                  </strong>
                                ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '12px' }}>لا يوجد طلاب في الطابور</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
