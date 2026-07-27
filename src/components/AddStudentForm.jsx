import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { LEVELS, matnForLevel } from '../utils/levels.js';
import { isValidGuardianPhone, normalizeGuardianPhone } from '../utils/phone.js';
import Modal from './Modal.jsx';

const EMPTY = {
  name: '',
  level: LEVELS[0].level,
  notes: '',
  guardian_phone: ''
};

/**
 * إضافة طالب جديد لحلقة المحفّظ — أربعة حقول:
 * اسم الطالب، المستوى، ملاحظة، رقم ولي الأمر.
 *
 * المتن يُشتق من المستوى تلقائياً، ونسبة الإنجاز تبدأ من صفر
 * ويتحكم بها المحفّظ مباشرة من الجدول الرئيسي.
 *
 * رقم الطالب لا يُولَّد في العميل: نُدرج السجل بلا رقم ويخصّصه
 * تسلسل داخل قاعدة البيانات (student_number_seq) ذرّياً — فلا يتكرر
 * الرقم أبداً حتى لو أضاف عشرون محفّظاً في اللحظة نفسها.
 *
 * تنفيذ مباشر: زر حفظ واحد يكتب السجل في قاعدة البيانات فوراً — بلا مسودات ولا مراجعة.
 */
export default function AddStudentForm({ teacherId, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    const name = form.name.trim();
    if (!name) {
      setError('اسم الطالب حقل مطلوب.');
      return;
    }
    if (!isValidGuardianPhone(form.guardian_phone)) {
      setError('رقم ولي الأمر غير صحيح. اكتبه هكذا: 0912345678');
      return;
    }

    setSaving(true);

    // بلا student_number — التسلسل في قاعدة البيانات يخصّصه ذرّياً
    const { data: saved, error: dbError } = await supabase
      .from('students')
      .insert({
        name,
        level: form.level,
        matn: matnForLevel(form.level),
        progress: 0,
        notes: form.notes.trim(),
        guardian_phone: normalizeGuardianPhone(form.guardian_phone),
        teacher_id: teacherId
      })
      .select('*, teacher:users!students_teacher_id_fkey(id, name, halaqa_number)')
      .single();

    setSaving(false);

    if (dbError) {
      setError('تعذّر الحفظ: ' + dbError.message);
      return;
    }

    onSaved(saved);
    onClose();
  };

  return (
    <Modal title="إضافة طالب جديد للحلقة" onClose={onClose}>
      <form onSubmit={handleSave}>
        {error && <div className="alert error">{error}</div>}

        <div className="field">
          <label>اسم الطالب</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="أحمد محمود"
            autoFocus
          />
        </div>

        <div className="field">
          <label>المستوى</label>
          <select value={form.level} onChange={(e) => set('level', e.target.value)}>
            {LEVELS.map((l) => (
              <option key={l.level} value={l.level}>
                {l.level}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>ملاحظة</label>
          <input
            type="text"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="اختياري"
          />
        </div>

        <div className="field">
          <label>رقم ولي الأمر</label>
          <input
            type="tel"
            inputMode="tel"
            value={form.guardian_phone}
            onChange={(e) => set('guardian_phone', e.target.value)}
            placeholder="0912345678"
            style={{ direction: 'ltr', textAlign: 'left' }}
          />
        </div>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'جارٍ الحفظ...' : 'حفظ'}
        </button>
      </form>
    </Modal>
  );
}
