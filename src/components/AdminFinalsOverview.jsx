import { useCallback, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabaseClient.js';
import { ar } from '../utils/numbers.js';
import { DEDUCTION_KEYS, QUAL_DEDUCTIONS } from '../utils/qualificationConfig.js';
import Modal from './Modal.jsx';

function labelForIndex(i) {
  const names = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'];
  return `السؤال ${names[i] || i + 1}`;
}

function questionsFor(e) {
  const rawDed = e.deductions;
  if (Array.isArray(rawDed) && rawDed.length > 0) return rawDed;
  return [{ question_index: 0, voice_score: e.voice_score || 0, deductions: rawDed || {} }];
}

function exportExcel(queueItem) {
  const evals = queueItem.evaluations || [];
  const studentName = queueItem.student?.name || '';
  const avg = evals.length > 0
    ? Math.round(evals.reduce((s, e) => s + e.final_score, 0) / evals.length)
    : 0;

  const HEADER = ['المحكم', 'النتيجة', 'السؤال', 'الصوت', 'الخصميات'];
  const data = [HEADER];

  evals.forEach((e, ei) => {
    const qs = questionsFor(e);
    const name = e.evaluator_name || `محكم ${ei + 1}`;
    const fScore = Math.round(e.final_score);

    qs.forEach((q, qi) => {
      const ded = q.deductions || {};
      const voice = q.voice_score || 0;
      const activeDed = DEDUCTION_KEYS.filter(c => (ded[c] || 0) > 0)
        .map(c => `${c}: ${ar(ded[c])} (-${QUAL_DEDUCTIONS[c]})`).join('، ');
      data.push([name, fScore, labelForIndex(qi), voice, activeDed || '—']);
    });
  });

  data.push([]);
  data.push(['متوسط النتيجة النهائية', `${ar(avg)}%`]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);

  ws['!cols'] = [
    { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 50 }
  ];

  const wscols = [{ wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 50 }];
  ws['!cols'] = wscols;

  XLSX.utils.book_append_sheet(wb, ws, 'التقييم');
  XLSX.writeFile(wb, `تقييم_${studentName}.xlsx`);
}

export default function AdminFinalsOverview({ onChanged }) {
  const [committees, setCommittees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(null);
  const [detailsQ, setDetailsQ] = useState(null);

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

  const handleFinalize = async (q) => {
    setFinalizing(q.id);
    const { error } = await supabase.from('committee_queue').update({
      status: 'finalized', finalized_at: new Date().toISOString()
    }).eq('id', q.id);
    if (error) { alert('فشل الاعتماد: ' + error.message); setFinalizing(null); return; }
    setFinalizing(null);
    load();
    onChanged?.();
  };

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
            const pending = c.queue.filter(q => q.status === 'pending' || q.status === 'evaluated');
            const finalized = c.queue.filter(q => q.status === 'finalized');

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
                      {ar(pending.length)} بانتظار الاعتماد
                    </span>
                    <span className="level-badge" style={{ background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.3)', color: '#6ee7b7' }}>
                      {ar(finalized.length)} معتمد
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
                          <th>تفاصيل التقييم</th>
                          <th>اعتماد النتيجة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.queue.map(q => {
                          const evalCount = q.evaluations?.length || 0;
                          const avg = evalCount > 0
                            ? Math.round(q.evaluations.reduce((s, e) => s + e.final_score, 0) / evalCount)
                            : null;
                          const isReady = evalCount >= 2 && q.status !== 'finalized';
                          const isFinalized = q.status === 'finalized';

                          let statusText = 'بانتظار التقييم';
                          let statusColor = '#fcd34d';
                          if (isFinalized) {
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
                              <td style={{ fontWeight: 600 }}>{q.student?.name || '—'}</td>
                              <td>
                                <span className="level-badge" style={{
                                  background: `${statusColor}1A`, borderColor: `${statusColor}40`, color: statusColor
                                }}>{statusText}</span>
                              </td>
                              <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                {evalCount > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    {q.evaluations.map(e => (
                                      <span key={e.id}>
                                        {e.evaluator_name}: {ar(Math.round(e.final_score))}%
                                      </span>
                                    ))}
                                  </div>
                                ) : '—'}
                              </td>
                              <td>
                                {avg !== null ? (
                                  <strong style={{ color: avg >= 80 ? '#6ee7b7' : avg >= 60 ? '#fcd34d' : '#fca5a5' }}>
                                    {ar(avg)}%
                                  </strong>
                                ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                              </td>
                              <td>
                                {evalCount > 0 && (
                                  <button className="btn-action"
                                    onClick={() => setDetailsQ(q)}
                                    style={{ padding: '4px 12px', fontSize: '0.78rem' }}>
                                    عرض
                                  </button>
                                )}
                              </td>
                              <td>
                                {isReady ? (
                                  <button className="btn-primary"
                                    onClick={() => handleFinalize(q)}
                                    disabled={finalizing === q.id}
                                    style={{ width: 'auto', padding: '6px 16px', fontSize: '0.82rem' }}>
                                    {finalizing === q.id ? '...' : 'اعتماد'}
                                  </button>
                                ) : isFinalized ? (
                                  <button className="btn-action add"
                                    onClick={() => exportExcel(q)}
                                    style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                                    تنزيل إكسل
                                  </button>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                    {evalCount === 1 ? 'بانتظار المحكم الآخر' : '—'}
                                  </span>
                                )}
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

      {detailsQ && (
        <AdminEvalDetail queueItem={detailsQ} onClose={() => setDetailsQ(null)} />
      )}
    </div>
  );
}

function AdminEvalDetail({ queueItem, onClose }) {
  const evaluations = queueItem.evaluations || [];

  return (
    <Modal title={`تفاصيل التقييم: ${queueItem.student?.name || ''}`} onClose={onClose}>
      {evaluations.length === 0 ? (
        <div className="empty-state">لا توجد تقييمات بعد</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {evaluations.map((e, ei) => {
            const qs = questionsFor(e);
            const isFirst = ei === 0;
            const boxColor = isFirst ? 'rgba(59,130,246,0.08)' : 'rgba(16,185,129,0.08)';
            const boxBorder = isFirst ? 'rgba(59,130,246,0.25)' : 'rgba(16,185,129,0.25)';

            return (
              <div key={e.id || ei} style={{
                background: boxColor, border: `1px solid ${boxBorder}`,
                borderRadius: 16, padding: '16px 20px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <strong style={{ fontSize: '1rem' }}>
                    تحكيم {isFirst ? 'الأول' : 'الثاني'}: {e.evaluator_name}
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {qs.map((q, qi) => {
                    const ded = q.deductions || {};
                    const voice = q.voice_score || 0;
                    const totalDed = DEDUCTION_KEYS.reduce((s, c) => s + (ded[c] || 0) * (QUAL_DEDUCTIONS[c] || 0), 0);
                    const qScore = Math.max(0, 10 - totalDed + Number(voice));
                    const activeDed = DEDUCTION_KEYS.filter(c => (ded[c] || 0) > 0);

                    return (
                      <div key={qi} style={{
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: 10, padding: '10px 14px',
                        border: '1px solid rgba(255,255,255,0.06)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{labelForIndex(qi)}</span>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: qScore >= 80 ? '#6ee7b7' : qScore >= 60 ? '#fcd34d' : '#fca5a5' }}>
                            {ar(Math.round(qScore))}%
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                          <span className="teacher-badge" style={{
                            background: 'rgba(147,197,253,0.1)', borderColor: 'rgba(147,197,253,0.2)',
                            color: '#93c5fd', fontSize: '0.72rem'
                          }}>
                            الصوت: {ar(voice)}/عشرة
                          </span>
                          {activeDed.map(c => (
                            <span key={c} className="teacher-badge" style={{
                              background: 'rgba(252,165,165,0.1)', borderColor: 'rgba(252,165,165,0.2)',
                              color: '#fca5a5', fontSize: '0.72rem'
                            }}>
                              {c}: {ar(ded[c])}× -{QUAL_DEDUCTIONS[c]}
                            </span>
                          ))}
                          {activeDed.length === 0 && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
