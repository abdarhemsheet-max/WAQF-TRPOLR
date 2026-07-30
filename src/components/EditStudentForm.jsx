import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { LEVELS, matnForLevel } from '../utils/levels.js';
import { isValidGuardianPhone, normalizeGuardianPhone } from '../utils/phone.js';
import Modal from './Modal.jsx';

/**
 * التحقق من تفرّد رقم الطالب قبل تنفيذ UPDATE.
 * استعلام مستقل يستثني سجل الطالب نفسه، فتعديل بقية الحقول
 * دون تغيير الرقم لا يعتبر تكراراً.
 */
async function isStudentNumberTaken(number, currentId) {
  const { data, error } = await supabase
    .from('students')
    .select('id, name')
    .eq('student_number', number);

  if (error) return { error };

  const conflict = (data ?? []).find((row) => row.id !== currentId);
  return { conflict: conflict ?? null };
}

/**
 * تعديل بيانات طالب قائم.
 * رقم الطالب قابل للتحرير هنا، ورقم ولي الأمر كذلك — وهي الثغرة
 * التي كانت تجعل رقماً خاطئاً غير قابل للتصحيح داخل النظام.
 */
export default function EditStudentForm({ student, onClose, onSaved }) {
  const [form, setForm] = useState({
    student_number: String(student.student_number ?? ''),
    name: student.name ?? '',
    level: student.level ?? LEVELS[0].level,
    guardian_phone: student.guardian_phone ?? '',
    notes: student.notes ?? '',
    memorization_center: student.memorization_center ?? '',
    voice_rating: student.voice_rating ?? 0
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    const number = form.student_number.trim();
    const name = form.name.trim();

    if (!number) {
      setError('رقم الطالب حقل مطلوب.');
      return;
    }
    if (!name) {
      setError('اسم الطالب حقل مطلوب.');
      return;
    }
    if (form.guardian_phone.trim() && !isValidGuardianPhone(form.guardian_phone)) {
      setError('رقم ولي الأمر غير صحيح. اكتبه هكذا: 0912345678');
      return;
    }

    setSaving(true);

    // 1) التحقق من التفرّد قبل UPDATE
    const { conflict, error: checkError } = await isStudentNumberTaken(number, student.id);
    if (checkError) {
      setSaving(false);
      setError('تعذّر التحقق من رقم الطالب: ' + checkError.message);
      return;
    }
    if (conflict) {
      setSaving(false);
      setError(`الرقم ${number} مستخدم مسبقاً للطالب «${conflict.name}». اختر رقماً آخر.`);
      return;
    }

    // 2) الرقم متاح ← تنفيذ التحديث
    const patch = {
      student_number: number,
      name,
      level: form.level,
      matn: matnForLevel(form.level),
      guardian_phone: form.guardian_phone.trim()
        ? normalizeGuardianPhone(form.guardian_phone)
        : '',
      notes: form.notes.trim(),
      memorization_center: form.memorization_center.trim(),
      voice_rating: Number(form.voice_rating) || 0
    };

    const { data, error: dbError } = await supabase
      .from('students')
      .update(patch)
      .eq('id', student.id)
      .select('*, teacher:users!students_teacher_id_fkey(id, name, halaqa_number)')
      .single();

    setSaving(false);

    if (dbError) {
      setError(
        dbError.code === '23505'
          ? `الرقم ${number} مستخدم مسبقاً. اختر رقماً آخر.`
          : 'تعذّر الحفظ: ' + dbError.message
      );
      return;
    }

    onSaved(data);
    onClose();
  };

  return (
    <Modal title={`تعديل بيانات: ${student.name}`} onClose={onClose}>
      <form onSubmit={handleSave}>
        {error && <div className="alert error">{error}</div>}

        <div className="form-row">
          <div className="field">
            <label>رقم الطالب</label>
            <input
              type="text"
              value={form.student_number}
              onChange={(e) => set('student_number', e.target.value)}
              style={{ direction: 'ltr', textAlign: 'left' }}
            />
          </div>
          <div className="field">
            <label>اسم الطالب</label>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
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
          <label>مركز التحفيظ</label>
          <input
            type="text"
            value={form.memorization_center}
            onChange={(e) => set('memorization_center', e.target.value)}
            placeholder="مثال: مركز تحفيظ الأوقاف طرابلس"
          />
        </div>

        <div className="field">
          <label>تقييم الصوت (من عشرة)</label>
          <input
            type="number"
            min="0"
            max="10"
            step="0.5"
            value={form.voice_rating}
            onChange={(e) => set('voice_rating', e.target.value)}
            style={{ direction: 'ltr', textAlign: 'left', width: 100 }}
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

        <div className="field">
          <label>ملاحظة</label>
          <input type="text" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'جارٍ التحقق والحفظ...' : 'حفظ التعديلات'}
        </button>
      </form>
    </Modal>
  );
}
