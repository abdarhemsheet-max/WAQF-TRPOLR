import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { useToast } from '../context/ToastContext.jsx';
import { ar } from '../utils/numbers.js';
import { TrashIcon, PlusIcon } from './Icons.jsx';
import Modal from './Modal.jsx';

export default function CommitteeManagement({ onChanged }) {
  const [committees, setCommittees] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', room: '' });
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [headId, setHeadId] = useState('');
  const [committeeType, setCommitteeType] = useState('dual');
  const [error, setError] = useState('');
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const [comRes, tRes, memRes] = await Promise.all([
      supabase.from('committees').select('*').order('created_at'),
      supabase.from('users').select('id, name, halaqa_number').eq('role', 'teacher').order('name'),
      supabase.from('committee_members').select('*')
    ]);
    if (comRes.data) setCommittees(comRes.data);
    if (tRes.data) setTeachers(tRes.data);
    if (memRes.data) {
      setCommittees(prev => prev.map(c => ({
        ...c,
        members: memRes.data.filter(m => m.committee_id === c.id).map(m => {
          const t = tRes.data?.find(u => u.id === m.user_id);
          return { ...m, teacher_name: t?.name || '', halaqa_number: t?.halaqa_number || '' };
        })
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm({ name: '', room: '' });
    setSelectedMembers([]);
    setHeadId('');
    setCommitteeType('dual');
    setError('');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('اسم اللجنة مطلوب'); return; }

    if (committeeType === 'dual') {
      if (selectedMembers.length < 2) { setError('يجب اختيار محفّظين اثنين على الأقل'); return; }
    } else {
      if (selectedMembers.length < 1) { setError('يجب اختيار المحكم المنفرد'); return; }
    }
    if (!headId) { setError('يجب اختيار رئيس اللجنة'); return; }

    const tempId = 'opt-' + Date.now();
    const memberNames = selectedMembers.map(uid => {
      const t = teachers.find(tt => tt.id === uid);
      return { user_id: uid, is_head: uid === headId, teacher_name: t?.name || '' };
    });
    const optimisticCommittee = { id: tempId, name: form.name.trim(), room: form.room.trim(), is_single_judge: committeeType === 'single', members: memberNames };
    setCommittees(prev => [...prev, optimisticCommittee]);
    setShowForm(false);

    try {
      const { data: committee, error: dbErr } = await supabase.from('committees').insert({
        name: form.name.trim(), room: form.room.trim(), is_single_judge: committeeType === 'single'
      }).select('*').single();

      if (dbErr) throw new Error(dbErr.message);

      const members = selectedMembers.map(uid => ({
        committee_id: committee.id, user_id: uid, is_head: uid === headId
      }));

      const { error: mErr } = await supabase.from('committee_members').insert(members);
      if (mErr) throw new Error(mErr.message);

      setCommittees(prev => prev.map(c => c.id === tempId ? {
        ...committee,
        members: members.map(m => {
          const t = teachers.find(tt => tt.id === m.user_id);
          return { ...m, teacher_name: t?.name || '', halaqa_number: t?.halaqa_number || '' };
        })
      } : c));

      resetForm();
      toast.success(`تم إنشاء ${committee.name}`);
      onChanged?.();
    } catch (err) {
      setCommittees(prev => prev.filter(c => c.id !== tempId));
      setShowForm(true);
      setError(err.message);
      toast.error(err.message);
    }
  };

  const toggleMember = (uid) => {
    if (committeeType === 'single') {
      setSelectedMembers(prev => prev.includes(uid) ? [] : [uid]);
      if (headId && headId !== uid) setHeadId('');
    } else {
      setSelectedMembers(prev =>
        prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
      );
      if (headId && !selectedMembers.includes(uid) && selectedMembers.length === 0) setHeadId('');
    }
  };

  const handleDelete = async (committee) => {
    if (!confirm(`حذف اللجنة "${committee.name}" نهائياً؟`)) return;

    const prev = committees;
    setCommittees(prev => prev.filter(c => c.id !== committee.id));
    setSavingId(committee.id);

    try {
      await supabase.from('committee_members').delete().eq('committee_id', committee.id);
      await supabase.from('committees').delete().eq('id', committee.id);
      toast.success(`تم حذف ${committee.name}`);
      onChanged?.();
    } catch (err) {
      setCommittees(prev => [...prev, committee]);
      toast.error('فشل حذف اللجنة');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div className="empty-state">جارٍ تحميل اللجان...</div>;

  return (
    <div className="glass-panel">
      <div className="glass-panel-head">
        <h2>لجان التحكيم</h2>
        <button className="btn-action add" onClick={() => { resetForm(); setShowForm(true); }}>
          <PlusIcon /> إضافة لجنة
        </button>
      </div>

      {committees.length === 0 ? (
        <div className="empty-state">لا توجد لجان تحكيم بعد</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {committees.map(c => (
            <div key={c.id} className="committee-card" style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, padding: '14px 18px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                <div>
                  <strong style={{ fontSize: '1rem' }}>{c.name}</strong>
                  {c.room && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginRight: 12 }}>📍 {c.room}</span>}
                  <span className="level-badge" style={{
                    background: c.is_single_judge ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.12)',
                    borderColor: c.is_single_judge ? 'rgba(245,158,11,0.3)' : 'rgba(59,130,246,0.3)',
                    color: c.is_single_judge ? '#fcd34d' : '#93c5fd',
                    fontSize: '0.75rem', marginRight: 8, padding: '2px 10px'
                  }}>
                    {c.is_single_judge ? 'محكم منفرد' : 'لجنة ثنائية'}
                  </span>
                </div>
                <button className="btn-action edit-btn delete" onClick={() => handleDelete(c)} style={{ padding: '6px 10px' }}>
                  <TrashIcon />
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(c.members || []).map(m => (
                  <span key={m.id} className="teacher-badge" style={{
                    background: m.is_head ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.12)',
                    borderColor: m.is_head ? 'rgba(245,158,11,0.35)' : 'rgba(59,130,246,0.3)',
                    color: m.is_head ? '#fcd34d' : '#93c5fd',
                    padding: '5px 12px', borderRadius: 8, fontSize: '0.82rem'
                  }}>
                    {m.teacher_name} {m.is_head ? '⭐' : ''}
                    {m.halaqa_number ? ` (${m.halaqa_number})` : ''}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal title="إنشاء لجنة تحكيم جديدة" onClose={() => setShowForm(false)}>
          <form onSubmit={handleCreate}>
            {error && <div className="alert error">{error}</div>}

            <div className="field">
              <label>نوع اللجنة</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => { setCommitteeType('dual'); setSelectedMembers([]); setHeadId(''); }}
                  className={`btn-action${committeeType === 'dual' ? ' add' : ''}`}
                  style={{
                    flex: 1, justifyContent: 'center', padding: '10px 14px',
                    background: committeeType === 'dual' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                    borderColor: committeeType === 'dual' ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)',
                    color: committeeType === 'dual' ? '#93c5fd' : 'var(--text-muted)'
                  }}>
                  لجنة ثنائية
                </button>
                <button type="button" onClick={() => { setCommitteeType('single'); setSelectedMembers([]); setHeadId(''); }}
                  className={`btn-action${committeeType === 'single' ? ' add' : ''}`}
                  style={{
                    flex: 1, justifyContent: 'center', padding: '10px 14px',
                    background: committeeType === 'single' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                    borderColor: committeeType === 'single' ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)',
                    color: committeeType === 'single' ? '#fcd34d' : 'var(--text-muted)'
                  }}>
                  محكم منفرد
                </button>
              </div>
            </div>

            <div className="field">
              <label>اسم اللجنة</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="لجنة التحكيم الأولى" />
            </div>

            <div className="field">
              <label>الغرفة (اختياري)</label>
              <input type="text" value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} placeholder="الغرفة 121" />
            </div>

            <div className="field">
              <label>{committeeType === 'single' ? 'اختيار المحكم المنفرد' : 'اختيار المحفّظين للجنة (عضوين فأكثر)'}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {teachers.map(t => {
                  const selected = selectedMembers.includes(t.id);
                  return (
                    <button key={t.id} type="button" onClick={() => toggleMember(t.id)}
                      className={`btn-action${selected ? ' add' : ''}`}
                      style={{
                        background: selected ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                        borderColor: selected ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)',
                        color: selected ? '#93c5fd' : 'var(--text-muted)',
                        padding: '8px 14px', fontSize: '0.82rem'
                      }}>
                      {t.name} ({t.halaqa_number || '—'}) {selected ? '✓' : ''}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedMembers.length > 0 && (
              <div className="field">
                <label>رئيس اللجنة (مسؤول إضافة الطلاب)</label>
                <select value={headId} onChange={e => setHeadId(e.target.value)}>
                  <option value="">اختر رئيس اللجنة</option>
                  {selectedMembers.map(uid => {
                    const t = teachers.find(tt => tt.id === uid);
                    return <option key={uid} value={uid}>{t?.name || ''}</option>;
                  })}
                </select>
              </div>
            )}

            <button type="submit" className="btn-primary">إنشاء اللجنة</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
