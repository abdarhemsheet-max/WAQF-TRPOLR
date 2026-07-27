import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import Modal from './Modal.jsx';

/**
 * إضافة محفّظ جديد للنظام (الأدمن الرئيسي فقط).
 * ثلاثة حقول حصراً: اسم المحفّظ، رمز الدخول، رمز الحلقة.
 * تنفيذ مباشر: زر حفظ واحد يكتب السجل في قاعدة البيانات فوراً — بلا مسودات ولا مراجعة.
 */
export default function AddTeacherForm({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', passcode: '', halaqa_number: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    const name = form.name.trim();
    const passcode = form.passcode.trim();
    const halaqa = form.halaqa_number.trim();

    if (!name || !passcode || !halaqa) {
      setError('اسم المحفّظ، رمز الدخول، ورمز الحلقة حقول مطلوبة.');
      return;
    }

    setSaving(true);
    const { data, error: dbError } = await supabase
      .from('users')
      .insert({ name, role: 'teacher', passcode, halaqa_number: halaqa })
      .select('id, name, role, halaqa_number')
      .single();
    setSaving(false);

    if (dbError) {
      setError(
        dbError.code === '23505'
          ? 'الاسم أو رمز الدخول مستخدم مسبقاً، اختر قيمة أخرى.'
          : 'تعذّر الحفظ: ' + dbError.message
      );
      return;
    }

    onSaved(data);
    onClose();
  };

  return (
    <Modal title="إضافة محفّظ جديد للنظام" onClose={onClose}>
      <form onSubmit={handleSave}>
        {error && <div className="alert error">{error}</div>}

        <div className="field">
          <label>اسم المحفّظ</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="عبدالرحمن الشمري"
          />
        </div>

        <div className="form-row">
          <div className="field">
            <label>رمز الدخول</label>
            <input
              type="text"
              value={form.passcode}
              onChange={(e) => set('passcode', e.target.value)}
              placeholder="T-102"
            />
          </div>
          <div className="field">
            <label>رمز الحلقة</label>
            <input
              type="text"
              value={form.halaqa_number}
              onChange={(e) => set('halaqa_number', e.target.value)}
              placeholder="الثانية"
            />
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'جارٍ الحفظ...' : 'حفظ'}
        </button>
      </form>
    </Modal>
  );
}
