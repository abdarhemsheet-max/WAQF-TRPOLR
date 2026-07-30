import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { ar } from '../utils/numbers.js';
import { DEDUCTION_KEYS, QUAL_DEDUCTIONS } from '../utils/qualificationConfig.js';
import { PlusIcon } from './Icons.jsx';
import Modal from './Modal.jsx';
import AddFinalStudent from './AddFinalStudent.jsx';
import CommitteeDashboardHeader from './CommitteeDashboardHeader.jsx';

export default function CommitteeQueue({ committee, user, onEvaluate, onChanged }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [readyQ, setReadyQ] = useState(null);
  const [detailsQ, setDetailsQ] = useState(null);

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

    const uRes = await supabase.from('users').select('id, name');
    const usersMap = {}; (uRes.data || []).forEach(u => { usersMap[u.id] = u.name; });

    setQueue(qRes.data.map(q => {
      const student = q.finals_student_id ? finalsMap[q.finals_student_id] : regMap[q.student_id];
      const evaluations = evals.filter(e => e.queue_id === q.id).map(e => ({ ...e, evaluator_name: usersMap[e.evaluator_id] || '' }));
      return { ...q, student, evaluations };
    }));
    setLoading(false);
  }, [committee.id]);

  useEffect(() => { load(); }, [load]);

  const isHead = committee.members?.some(m => m.user_id === user.id && m.is_head);
  const otherMember = committee.members?.find(m => m.user_id !== user.id);

  const handleReady = (q) => setReadyQ(q);
  const handleStartEval = () => { if (readyQ) { setReadyQ(null); onEvaluate(readyQ); } };

  if (loading) return <div className="empty-state">جارٍ تحميل الطابور...</div>;

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
            </tr>
          </thead>
          <tbody>
            {queue.map(q => {
              const myEval = q.evaluations?.find(e => e.evaluator_id === user.id);
              const otherEval = q.evaluations?.find(e => e.evaluator_id !== user.id);
              const evalCount = q.evaluations?.length || 0;
              const avg = evalCount > 0
                ? Math.round(q.evaluations.reduce((s, e) => s + e.final_score, 0) / evalCount)
                : null;
              const canEvaluate = q.status !== 'finalized' && !myEval;

              let statusText = 'بانتظار التقييم';
              let statusColor = '#fcd34d';
              if (q.status === 'finalized') {
                statusText = 'معتمد';
                statusColor = '#6ee7b7';
              } else if (evalCount === 1) {
                statusText = 'تم تقييم محكم واحد';
                statusColor = '#93c5fd';
              } else if (evalCount >= 2) {
                statusText = 'تم التقييم';
                statusColor = '#6ee7b7';
              }

              return (
                <tr key={q.id}>
                  <td style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => setDetailsQ(q)}>
                    {q.student?.name || '—'}
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginRight: 8, display: 'inline-block' }}>
                      ℹ️
                    </span>
                  </td>
                  <td>
                    <span className="level-badge" style={{
                      background: `${statusColor}1A`, borderColor: `${statusColor}40`, color: statusColor
                    }}>{statusText}</span>
                  </td>
                  <td>
                    {q.evaluations?.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {q.evaluations.map(e => {
                          const isMe = e.evaluator_id === user.id;
                          return (
                            <div key={e.id} style={{
                              display: 'flex', alignItems: 'center', gap: 6,
                              padding: '4px 8px', borderRadius: 6,
                              background: isMe ? 'rgba(59,130,246,0.08)' : 'transparent'
                            }}>
                              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                {e.evaluator_name}
                              </span>
                              <strong style={{
                                fontSize: '0.85rem',
                                color: e.final_score >= 80 ? '#6ee7b7' : e.final_score >= 60 ? '#fcd34d' : '#fca5a5'
                              }}>
                                {ar(Math.round(e.final_score))}%
                              </strong>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    {avg !== null ? (
                      <strong style={{ fontSize: '1rem', color: avg >= 80 ? '#6ee7b7' : avg >= 60 ? '#fcd34d' : '#fca5a5' }}>
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
                </tr>
              );
            })}
            {queue.length === 0 && (
              <tr><td colSpan={5}><div className="empty-state">لا يوجد طلاب في الطابور</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddFinalStudent
          committeeId={committee.id} userId={user.id}
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

      {detailsQ && (
        <DetailsBreakdown queueItem={detailsQ} onClose={() => setDetailsQ(null)} />
      )}
    </div>
  );
}

function DetailsBreakdown({ queueItem, onClose }) {
  const evaluations = queueItem.evaluations || [];
  const questions = ['الحفظ', 'التجويد والأداء', 'الصوت'];

  return (
    <Modal title={`تفاصيل التحكيم: ${queueItem.student?.name || ''}`} onClose={onClose}>
      {evaluations.length === 0 ? (
        <div className="empty-state">لا توجد تقييمات بعد</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {evaluations.map((e, idx) => {
            const deductions = e.deductions || {};
            const voiceScore = e.voice_score || 0;

            const q1 = ['التلعثم', 'التردد', 'النقص أو الزيادة'];
            const q2 = ['اللحن الخفي', 'اللحن', 'التنبيه'];

            const q1Ded = Math.round(q1.reduce((s, c) => s + (deductions[c] || 0) * (QUAL_DEDUCTIONS[c] || 0), 0) * 100) / 100;
            const q2Ded = Math.round(q2.reduce((s, c) => s + (deductions[c] || 0) * (QUAL_DEDUCTIONS[c] || 0), 0) * 100) / 100;
            const q1Score = Math.max(0, Math.round((10 - q1Ded) * 100) / 100);
            const q2Score = Math.max(0, Math.round((10 - q2Ded) * 100) / 100);

            const boxColor = idx === 0 ? 'rgba(59,130,246,0.08)' : 'rgba(16,185,129,0.08)';
            const boxBorder = idx === 0 ? 'rgba(59,130,246,0.25)' : 'rgba(16,185,129,0.25)';

            return (
              <div key={e.id || idx} style={{
                background: boxColor, border: `1px solid ${boxBorder}`,
                borderRadius: 16, padding: '16px 20px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <strong style={{ fontSize: '1rem' }}>
                    تحكيم رقم {idx + 1}: {e.evaluator_name}
                  </strong>
                  <span className="level-badge" style={{
                    background: e.final_score >= 80 ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                    borderColor: e.final_score >= 80 ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)',
                    color: e.final_score >= 80 ? '#6ee7b7' : '#fcd34d',
                    fontWeight: 700
                  }}>
                    {ar(Math.round(e.final_score))}%
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>السؤال الأول: الحفظ</span>
                    <span style={{ fontWeight: 600 }}>{ar(q1Score)}/عشرة {q1Ded > 0 && <span style={{ color: '#fca5a5', fontSize: '0.78rem' }}>(-{q1Ded.toFixed(1)})</span>}</span>
                  </div>
                  {q1.filter(c => (deductions[c] || 0) > 0).map(c => (
                    <div key={c} style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: 16 }}>
                      {c}: {ar(deductions[c])} × -{QUAL_DEDUCTIONS[c]}
                    </div>
                  ))}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>السؤال الثاني: التجويد والأداء</span>
                    <span style={{ fontWeight: 600 }}>{ar(q2Score)}/عشرة {q2Ded > 0 && <span style={{ color: '#fca5a5', fontSize: '0.78rem' }}>(-{q2Ded.toFixed(1)})</span>}</span>
                  </div>
                  {q2.filter(c => (deductions[c] || 0) > 0).map(c => (
                    <div key={c} style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: 16 }}>
                      {c}: {ar(deductions[c])} × -{QUAL_DEDUCTIONS[c]}
                    </div>
                  ))}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>السؤال الثالث: الصوت</span>
                    <span style={{ fontWeight: 600 }}>{ar(voiceScore)}/عشرة</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
