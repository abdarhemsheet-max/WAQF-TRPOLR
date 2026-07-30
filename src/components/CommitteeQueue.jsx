import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { ar } from '../utils/numbers.js';
import { PlusIcon } from './Icons.jsx';
import Modal from './Modal.jsx';
import AddFinalStudent from './AddFinalStudent.jsx';
import CommitteeDashboardHeader from './CommitteeDashboardHeader.jsx';

export default function CommitteeQueue({ committee, user, onEvaluate, onChanged }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [readyQ, setReadyQ] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [qRes, eRes] = await Promise.all([
      supabase.from('committee_queue').select('*').eq('committee_id', committee.id).order('created_at'),
      supabase.from('qualification_evaluations').select('*')
    ]);
    if (!qRes.data) { setLoading(false); return; }

    const fsIds = [...new Set(qRes.data.filter(q => q.finals_student_id).map(q => q.finals_student_id))];
    const regIds = [...new Set(qRes.data.filter(q => q.student_id).map(q => q.student_id))];

    const [fsRes, sRes] = await Promise.all([
      fsIds.length ? supabase.from('finals_students').select('*') : { data: [] },
      regIds.length ? supabase.from('students').select('id, name, level, matn, progress') : { data: [] }
    ]);

    const finalsMap = {};
    (fsRes.data || []).forEach(f => { finalsMap[f.id] = f; });
    const regMap = {};
    (sRes.data || []).forEach(s => { regMap[s.id] = s; });

    const evals = eRes.data || [];
    setQueue(qRes.data.map(q => {
      const student = q.finals_student_id ? finalsMap[q.finals_student_id] : regMap[q.student_id];
      const qEvals = evals.filter(e => e.queue_id === q.id);
      return { ...q, student, evaluations: qEvals };
    }));
    setLoading(false);
  }, [committee.id]);

  useEffect(() => { load(); }, [load]);

  const isHead = committee.members?.some(m => m.user_id === user.id && m.is_head);

  const handleReady = (q) => {
    setReadyQ(q);
  };

  const handleStartEval = () => {
    if (readyQ) {
      setReadyQ(null);
      onEvaluate(readyQ);
    }
  };

  if (loading) return <div className="empty-state">جارٍ تحميل الطابور...</div>;

  const otherMember = committee.members?.find(m => m.user_id !== user.id);

  return (
    <div>
      <CommitteeDashboardHeader committee={committee} user={user} />

      <div className="glass-panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: '1rem' }}>طابور التصفيات</h2>
        {isHead && (
          <button className="btn-action add" onClick={() => setShowAdd(true)}>
            <PlusIcon /> إضافة طالب
          </button>
        )}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>الطالب</th>
              <th>الحالة</th>
              <th>تقييم العضو</th>
              <th>متوسط النتيجة</th>
              <th>التحكيم</th>
              <th>اعتماد النتيجة</th>
            </tr>
          </thead>
          <tbody>
            {queue.map(q => {
              const myEval = q.evaluations?.find(e => e.evaluator_id === user.id);
              const otherEval = q.evaluations?.find(e => e.evaluator_id === otherMember?.user_id);
              const avg = q.evaluations?.length > 0
                ? Math.round(q.evaluations.reduce((s, e) => s + e.final_score, 0) / q.evaluations.length)
                : null;
              const canEvaluate = q.status !== 'finalized' && !myEval;
              const canFinalize = q.status === 'evaluated' && q.evaluations?.length >= 2 && isHead && !q.finalized_score;

              const statusLabel = q.status === 'pending' ? 'بانتظار التقييم'
                : q.status === 'evaluated' ? 'تم التقييم'
                : 'معتمد';
              const statusColor = q.status === 'pending' ? '#fcd34d'
                : q.status === 'evaluated' ? '#93c5fd'
                : '#6ee7b7';

              return (
                <tr key={q.id}>
                  <td style={{ fontWeight: 600 }}>{q.student?.name || '—'}</td>
                  <td>
                    <span className="level-badge" style={{
                      background: `${statusColor}1A`, borderColor: `${statusColor}40`, color: statusColor
                    }}>{statusLabel}</span>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>
                    {otherEval ? (
                      <span style={{ color: otherEval.final_score >= 80 ? '#6ee7b7' : otherEval.final_score >= 60 ? '#fcd34d' : '#fca5a5' }}>
                        {ar(Math.round(otherEval.final_score))}%
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    {avg !== null ? (
                      <strong style={{ color: avg >= 80 ? '#6ee7b7' : avg >= 60 ? '#fcd34d' : '#fca5a5' }}>
                        {ar(avg)}%
                      </strong>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    {canEvaluate ? (
                      <button className="btn-action add" onClick={() => handleReady(q)}>
                        التحكيم
                      </button>
                    ) : myEval ? (
                      <span className="level-badge" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.25)', color: '#6ee7b7' }}>
                        {ar(Math.round(myEval.final_score))}%
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>—</span>
                    )}
                  </td>
                  <td>
                    {canFinalize ? (
                      <button className="btn-action" style={{
                        background: 'rgba(16,185,129,0.15)', color: '#34d399', borderColor: 'rgba(16,185,129,0.3)'
                      }} onClick={() => handleFinalize(q, avg)}>
                        اعتماد
                      </button>
                    ) : q.finalized_score ? (
                      <span className="level-badge" style={{ background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.3)', color: '#6ee7b7' }}>
                        ✓ {ar(Math.round(q.finalized_score))}%
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {queue.length === 0 && (
              <tr><td colSpan={6}><div className="empty-state">لا يوجد طلاب في الطابور</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddFinalStudent
          committeeId={committee.id}
          userId={user.id}
          onClose={() => setShowAdd(false)}
          onSaved={() => { load(); onChanged?.(); }}
        />
      )}

      {readyQ && (
        <Modal title="" onClose={() => setReadyQ(null)}>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎯</div>
            <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>هل أنت مستعد للتحكيم؟</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
              {readyQ.student?.name} — {readyQ.student?.level} · {readyQ.student?.matn}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn-primary" onClick={handleStartEval} style={{ width: 'auto', padding: '10px 36px' }}>
                نعم
              </button>
              <button className="btn-action" onClick={() => setReadyQ(null)} style={{ padding: '10px 36px' }}>
                لا
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

async function handleFinalize(q, avg) {
  if (!confirm(`اعتماد نتيجة "${q.student?.name}" بمتوسط ${avg}%؟`)) return;
  await supabase.from('committee_queue').update({
    status: 'finalized', finalized_score: avg
  }).eq('id', q.id);
  window.location.reload();
}
