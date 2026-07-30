import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { ar } from '../utils/numbers.js';
import { PlusIcon } from './Icons.jsx';
import Modal from './Modal.jsx';
import AddFinalStudent from './AddFinalStudent.jsx';

export default function CommitteeQueue({ committee, user, onEvaluate, onChanged }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

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
      return { ...q, student, evaluations: evals.filter(e => e.queue_id === q.id) };
    }));
    setLoading(false);
  }, [committee.id]);

  useEffect(() => { load(); }, [load]);

  const isHead = committee.members?.some(m => m.user_id === user.id && m.is_head);
  const pending = queue.filter(q => q.status === 'pending');
  const evaluated = queue.filter(q => q.status === 'evaluated');

  if (loading) return <div className="empty-state">جارٍ تحميل الطابور...</div>;

  const columns = ['الطالب', 'المستوى', 'المتن', 'الإنجاز', 'الحالة', 'إجراءات'];

  return (
    <div className="glass-panel" style={{ marginTop: 16 }}>
      <div className="glass-panel-head">
        <div>
          <h2>طابور التصفيات — {committee.name}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 4 }}>
            {committee.room && <span>📍 {committee.room} · </span>}
            {ar(pending.length)} في الانتظار · {ar(evaluated.length)} تم تقييمها
          </p>
        </div>
        {isHead && (
          <button className="btn-action add" onClick={() => setShowAdd(true)}>
            <PlusIcon /> إضافة طالب لطابور التصفيات
          </button>
        )}
      </div>

      <div className="table-container" style={{ marginTop: 8 }}>
        <table>
          <thead>
            <tr>{columns.map(c => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {[...pending, ...evaluated].map(q => {
              const myEval = q.evaluations?.find(e => e.evaluator_id === user.id);
              const canEvaluate = q.status === 'pending' && !myEval;
              return (
                <tr key={q.id}>
                  <td style={{ fontWeight: 600 }}>{q.student?.name || '—'}</td>
                  <td><span className="level-badge">{q.student?.level || '—'}</span></td>
                  <td style={{ color: 'var(--text-muted)' }}>{q.student?.matn || '—'}</td>
                  <td>{ar(q.student?.progress || 0)}%</td>
                  <td>
                    <span className="level-badge" style={{
                      background: q.status === 'pending' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
                      borderColor: q.status === 'pending' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)',
                      color: q.status === 'pending' ? '#fcd34d' : '#6ee7b7'
                    }}>
                      {q.status === 'pending' ? 'بانتظار التقييم' : 'تم التقييم'}
                    </span>
                  </td>
                  <td>
                    {canEvaluate ? (
                      <button className="btn-action add" onClick={() => onEvaluate(q)}>
                        التقييم
                      </button>
                    ) : myEval ? (
                      <span className="level-badge" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.25)', color: '#6ee7b7' }}>
                        تم تقييمك ({ar(Math.round(myEval.final_score))}%)
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {queue.length === 0 && (
              <tr><td colSpan={6}><div className="empty-state">لا يوجد طلاب في طابور التصفيات</div></td></tr>
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
    </div>
  );
}
