import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { LEVELS, matnForLevel } from '../utils/levels.js';
import { normalizeGuardianPhone } from '../utils/phone.js';
import Modal from './Modal.jsx';

const EMPTY = {
  name: '',
  guardian_phone: '',
  memorization_center: '',
  level: LEVELS[0].level,
  matn: '',
  progress: 0
};

export default function AddFinalStudent({ committeeId, userId, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleLevelChange = (level) => {
    setForm((f) => ({ ...f, level, matn: matnForLevel(level) }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    const name = form.name.trim();
    if (!name) { setError('اسم الطالب مطلوب'); return; }

    setSaving(true);

    const { data: fs, error: fsErr } = await supabase
      .from('finals_students')
      .insert({
        name,
        guardian_phone: normalizeGuardianPhone(form.guardian_phone),
        memorization_center: form.memorization_center.trim(),
        level: form.level,
        matn: form.matn || matnForLevel(form.level),
        progress: Math.min(100, Math.max(0, Number(form.progress) || 0)),
        created_by: userId
      })
      .select('*')
      .single();

    if (fsErr) { setError('فشل الحفظ: ' + fsErr.message); setSaving(false); return; }

    const { error: qErr } = await supabase
      .from('committee_queue')
      .insert({
        committee_id: committeeId,
        finals_student_id: fs.id,
        added_by: userId,
        status: 'pending'
      });

    setSaving(false);
    if (qErr) { setError('فشل إضافة الطابور: ' + qErr.message); return; }

    onSaved?.(fs);
    onClose();
  };

  return (
    <Modal title="إضافة طالب لطابور التصفيات" onClose={onClose}>
      <form onSubmit={handleSave}>
        {error && <div className="alert error">{error}</div>}

        <div className="field">
          <label>اسم الطالب</label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="أحمد المختار" autoFocus />
        </div>

        <div className="field">
          <label>المستوى</label>
          <select value={form.level} onChange={e => handleLevelChange(e.target.value)}>
            {LEVELS.map(l => <option key={l.level} value={l.level}>{l.level}</option>)}
          </select>
        </div>

        <div className="field">
          <label>المتن</label>
          <input type="text" value={form.matn} onChange={e => set('matn', e.target.value)} placeholder={matnForLevel(form.level)} />
        </div>

        <div className="field">
          <label>الإنجاز (%)</label>
          <input type="number" min="0" max="100" value={form.progress} onChange={e => set('progress', e.target.value)}
            style={{ direction: 'ltr', textAlign: 'left', width: 100 }} />
        </div>

        <div className="field">
          <label>مركز التحفيظ</label>
          <input type="text" value={form.memorization_center} onChange={e => set('memorization_center', e.target.value)} placeholder="مركز تحفيظ الأوقاف" />
        </div>

        <div className="field">
          <label>رقم ولي الأمر</label>
          <input type="tel" inputMode="tel" value={form.guardian_phone} onChange={e => set('guardian_phone', e.target.value)}
            placeholder="0912345678" style={{ direction: 'ltr', textAlign: 'left' }} />
        </div>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'جارٍ الحفظ...' : 'إضافة إلى طابور التصفيات'}
        </button>
      </form>
    </Modal>
  );
}
