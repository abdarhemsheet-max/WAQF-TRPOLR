import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { LEVELS } from '../utils/levels.js';
import { normalizeGuardianPhone } from '../utils/phone.js';
import Modal from './Modal.jsx';

const EMPTY = {
  name: '',
  guardian_phone: '',
  memorization_center: '',
  level: LEVELS[0].level
};

export default function AddFinalStudent({ committeeId, userId, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    const name = form.name.trim();
    if (!name) { setError('اسم الطالب مطلوب'); return; }

    setSaving(true);

    const phone = form.guardian_phone.trim();
    const payload = {
      name,
      guardian_phone: phone ? normalizeGuardianPhone(phone) : null,
      memorization_center: form.memorization_center.trim(),
      level: form.level,
      created_by: userId
    };

    const { data: fs, error: fsErr } = await supabase
      .from('finals_students')
      .insert(payload)
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
          <select value={form.level} onChange={e => set('level', e.target.value)}>
            {LEVELS.map(l => <option key={l.level} value={l.level}>{l.level}</option>)}
          </select>
        </div>

        <div className="field">
          <label>مركز التحفيظ</label>
          <input type="text" value={form.memorization_center} onChange={e => set('memorization_center', e.target.value)} placeholder="مركز تحفيظ الأوقاف" />
        </div>

        <div className="field">
          <label>رقم ولي الأمر <span className="field-optional">اختياري</span></label>
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
