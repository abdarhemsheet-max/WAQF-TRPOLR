import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { ar } from '../utils/numbers.js';
import { PlusIcon } from './Icons.jsx';
import Modal from './Modal.jsx';

export default function CommitteeQueue({ committee, user, onChanged }) {
  const [queue, setQueue] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [qRes, sRes, eRes] = await Promise.all([
      supabase.from('committee_queue').select('*').eq('committee_id', committee.id).order('created_at'),
      supabase.from('students').select('id, name, level, matn, progress').order('name'),
      supabase.from('qualification_evaluations').select('*')
    ]);
    if (qRes.data) {
      const evals = eRes.data || [];
      setQueue(qRes.data.map(q => ({
        ...q,
        student: sRes.data?.find(s => s.id === q.student_id) || null,
        evaluations: evals.filter(e => e.queue_id === q.id)
      })));
    }
    if (sRes.data) setStudents(sRes.data);
    setLoading(false);
  }, [committee.id]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!selectedStudent) return;
    const { error: dbErr } = await supabase.from('committee_queue').insert({
      committee_id: committee.id, student_id: selectedStudent,
      added_by: user.id, status: 'pending'
    });
    if (!dbErr) {
      setSelectedStudent('');
      setShowAdd(false);
      load();
      onChanged?.();
    }
  };

  if (loading) return <div className="empty-state">جارٍ تحميل الطابور...</div>;

  const pendingCount = queue.filter(q => q.status === 'pending').length;
  const evaluatedCount = queue.filter(q => q.status === 'evaluated').length;

  return (
    <div className="glass-panel" style={{ marginTop: 16 }}>
      <div className="glass-panel-head">
        <div>
          <h2>طابور التصفية — {committee.name}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 4 }}>
            {committee.room && <span>📍 {committee.room} · </span>}
            {ar(pendingCount)} في الانتظار · {ar(evaluatedCount)} تم تقييمها
          </p>
        </div>
        {user.id && committee.members?.find(m => m.user_id === user.id && m.is_head) && (
          <button className="btn-action add" onClick={() => setShowAdd(true)}>
            <PlusIcon /> إضافة طالب
          </button>
        )}
      </div>

      <div className="table-container" style={{ marginTop: 8 }}>
        <table>
          <thead>
            <tr>
              <th>الطالب</th>
              <th>المستوى</th>
              <th>المتن</th>
              <th>الإنجاز</th>
              <th>الحالة</th>
              <th>عدد التقييمات</th>
            </tr>
          </thead>
          <tbody>
            {queue.map(q => (
              <tr key={q.id}>
                <td style={{ fontWeight: 600 }}>{q.student?.name || '—'}</td>
                <td><span className="level-badge">{q.student?.level || '—'}</span></td>
                <td style={{ color: 'var(--text-muted)' }}>{q.student?.matn || '—'}</td>
                <td>{ar(q.student?.progress || 0)}%</td>
                <td>
                  <span className={`level-badge`} style={{
                    background: q.status === 'pending' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
                    borderColor: q.status === 'pending' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)',
                    color: q.status === 'pending' ? '#fcd34d' : '#6ee7b7'
                  }}>
                    {q.status === 'pending' ? 'بانتظار التقييم' : 'تم التقييم'}
                  </span>
                </td>
                <td>{ar(q.evaluations?.length || 0)}</td>
              </tr>
            ))}
            {queue.length === 0 && (
              <tr><td colSpan={6}><div className="empty-state">لا يوجد طلاب في طابور التصفية</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <Modal title="إضافة طالب إلى طابور التصفية" onClose={() => setShowAdd(false)}>
          <div className="field">
            <label>اختر الطالب</label>
            <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
              <option value="">اختر...</option>
              {students.filter(s => !queue.find(q => q.student_id === s.id && q.status === 'pending')).map(s => (
                <option key={s.id} value={s.id}>{s.name} — {s.level} ({ar(s.progress)}%)</option>
              ))}
            </select>
          </div>
          <button className="btn-primary" onClick={handleAdd} disabled={!selectedStudent}>إضافة</button>
        </Modal>
      )}
    </div>
  );
}
