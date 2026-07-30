import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { ar } from '../utils/numbers.js';
import TopBar from '../components/TopBar.jsx';
import CommitteeManagement from '../components/CommitteeManagement.jsx';
import CommitteeQueue from '../components/CommitteeQueue.jsx';
import QualificationScoring from '../components/QualificationScoring.jsx';

export default function Qualifications() {
  const { user, isAdmin } = useAuth();
  const [committees, setCommittees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeQueue, setActiveQueue] = useState(null);
  const [scoringItem, setScoringItem] = useState(null);

  const loadCommittees = useCallback(async () => {
    setLoading(true);
    const [comRes, memRes] = await Promise.all([
      supabase.from('committees').select('*').order('created_at'),
      supabase.from('committee_members').select('*')
    ]);

    if (comRes.data && memRes.data) {
      const userCommittees = isAdmin
        ? comRes.data
        : comRes.data.filter(c =>
            memRes.data.some(m => m.committee_id === c.id && m.user_id === user.id)
          );

      const enriched = userCommittees.map(c => ({
        ...c,
        members: memRes.data.filter(m => m.committee_id === c.id)
      }));

      if (!isAdmin) {
          const uRes = await supabase.from('users').select('id, name, halaqa_number');
        if (uRes.data) {
          enriched.forEach(c => {
            c.members = c.members.map(m => {
              const u = uRes.data.find(t => t.id === m.user_id);
              return { ...m, teacher_name: u?.name || '' };
            });
          });
        }
      }

      setCommittees(enriched);
    }
    setLoading(false);
  }, [user.id, isAdmin]);

  useEffect(() => { loadCommittees(); }, [loadCommittees]);

  const userCommittee = committees.find(c =>
    c.members?.some(m => m.user_id === user.id)
  );
  const isHead = userCommittee?.members?.some(m => m.user_id === user.id && m.is_head);
  const isEvaluator = userCommittee && !isHead;

  return (
    <div className="container">
      <TopBar />

      <div className="title">
        <h1>تصفية دورة حفاظ الوحيين</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          {isAdmin ? 'إدارة لجان التحكيم والتصفيات' : 'مرحباً بك في التصفيات'}
        </p>
      </div>

      {loading ? (
        <div className="empty-state">جارٍ تحميل البيانات...</div>
      ) : (
        <>
          {scoringItem ? (
            <QualificationScoring
              queueItem={scoringItem}
              user={user}
              onClose={() => setScoringItem(null)}
              onSaved={() => { setScoringItem(null); loadCommittees(); }}
            />
          ) : (
            <>
              {isAdmin && (
                <CommitteeManagement onChanged={loadCommittees} />
              )}

              {isAdmin && committees.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h2 style={{ marginBottom: 12, fontSize: '1rem' }}>جميع اللجان ({ar(committees.length)})</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {committees.map(c => (
                      <div key={c.id} className="committee-card" style={{
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 16, padding: '14px 18px'
                      }}>
                        <div style={{ fontWeight: 600, marginBottom: 6 }}>
                          {c.name} {c.room ? <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— {c.room}</span> : ''}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(c.members || []).map(m => {
                            const isHeadMember = m.is_head;
                            return (
                              <span key={m.id || m.user_id} className="teacher-badge" style={{
                                background: isHeadMember ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.12)',
                                borderColor: isHeadMember ? 'rgba(245,158,11,0.35)' : 'rgba(59,130,246,0.3)',
                                color: isHeadMember ? '#fcd34d' : '#93c5fd',
                                padding: '4px 10px', borderRadius: 8, fontSize: '0.8rem'
                              }}>{m.teacher_name || '—'} {isHeadMember ? '⭐' : ''}</span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isAdmin && userCommittee && (
                <>
                  <div className="gateway-grid" style={{ marginTop: 20 }}>
                    <div className="gateway-card" onClick={() => setActiveQueue(userCommittee)}
                      style={{ cursor: 'pointer', padding: '20px' }}>
                      <div className="icon-circle">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 28, height: 28 }}>
                          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                          <rect x="9" y="3" width="6" height="4" rx="1" />
                          <path d="M9 12l2 2 4-4" />
                        </svg>
                      </div>
                      <h2 style={{ fontSize: '1rem' }}>{userCommittee.name}</h2>
                      <p style={{ fontSize: '0.85rem' }}>
                        {userCommittee.room || ''} {isHead ? '· أنت رئيس اللجنة ⭐' : '· عضو لجنة التحكيم'}
                      </p>
                    </div>
                  </div>

                  {activeQueue?.id === userCommittee.id && (
                    <CommitteeQueue committee={userCommittee} user={user} onChanged={loadCommittees} />
                  )}

                  {isEvaluator && (
                    <div style={{ marginTop: 20 }}>
                      <EvaluatorView committee={userCommittee} user={user} onEvaluate={setScoringItem} onChanged={loadCommittees} />
                    </div>
                  )}

                  {isHead && activeQueue?.id !== userCommittee.id && (
                    <CommitteeQueue committee={userCommittee} user={user} onChanged={loadCommittees} />
                  )}
                </>
              )}

              {!isAdmin && !userCommittee && (
                <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', marginBottom: 16 }}>🏆</div>
                  <h2 style={{ marginBottom: 8 }}>لم يتم تعيينك في لجنة تحكيم</h2>
                  <p style={{ color: 'var(--text-muted)' }}>يتم إعداد التصفيات — سيتم إشعارك عند الانضمام للجنة</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function EvaluatorView({ committee, user, onEvaluate, onChanged }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [qRes, eRes] = await Promise.all([
      supabase.from('committee_queue').select('*').eq('committee_id', committee.id).order('created_at'),
      supabase.from('qualification_evaluations').select('*').eq('evaluator_id', user.id)
    ]);
    if (qRes.data) {
      const sRes = await supabase.from('students').select('id, name, level, matn, progress');
      setQueue(qRes.data.map(q => ({
        ...q,
        student: sRes.data?.find(s => s.id === q.student_id) || null,
        myEval: (eRes.data || []).find(e => e.queue_id === q.id)
      })));
    }
    setLoading(false);
  }, [committee.id, user.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="empty-state">جارٍ التحميل...</div>;

  const pending = queue.filter(q => !q.myEval);
  const done = queue.filter(q => q.myEval);

  return (
    <div className="glass-panel">
      <div className="glass-panel-head">
        <h2>تقييم الطلاب — {committee.name}</h2>
      </div>

      {pending.length > 0 && (
        <>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 8 }}>
            بانتظار تقييمك ({ar(pending.length)})
          </h3>
          <div className="table-container" style={{ marginBottom: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>الطالب</th>
                  <th>المستوى</th>
                  <th>المتن</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(q => (
                  <tr key={q.id}>
                    <td style={{ fontWeight: 600 }}>{q.student?.name || '—'}</td>
                    <td><span className="level-badge">{q.student?.level || '—'}</span></td>
                    <td style={{ color: 'var(--text-muted)' }}>{q.student?.matn || '—'}</td>
                    <td>
                      <button className="btn-action add" onClick={() => onEvaluate(q)}>
                        بدء التقييم
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {done.length > 0 && (
        <>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 8 }}>
            تم تقييمك ({ar(done.length)})
          </h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>الطالب</th>
                  <th>النتيجة</th>
                </tr>
              </thead>
              <tbody>
                {done.map(q => (
                  <tr key={q.id}>
                    <td style={{ fontWeight: 600 }}>{q.student?.name || '—'}</td>
                    <td>
                      <span className="level-badge" style={{
                        background: q.myEval.final_score >= 80 ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                        borderColor: q.myEval.final_score >= 80 ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)',
                        color: q.myEval.final_score >= 80 ? '#6ee7b7' : '#fcd34d'
                      }}>
                        {ar(Math.round(q.myEval.final_score))}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {queue.length === 0 && (
        <div className="empty-state">لا يوجد طلاب في طابور التصفية</div>
      )}
    </div>
  );
}
