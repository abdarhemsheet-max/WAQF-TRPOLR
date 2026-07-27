import { useState } from 'react';
import { ar } from '../utils/numbers.js';
import { normalizeGuardianPhone, displayGuardianPhone } from '../utils/phone.js';
import { renderTemplate } from '../utils/templates.js';
import Modal from './Modal.jsx';

function downloadCSV(rows, filename) {
  const BOM = '\uFEFF';
  const header = 'اسم الطالب,رقم ولي الأمر,الرسالة';
  const lines = rows.map((r) => {
    const phone = displayGuardianPhone(r.phone);
    const msg = r.message.replace(/,/g, '،').replace(/\n/g, ' ');
    return `${r.name},${phone},${msg}`;
  });
  const csv = BOM + header + '\n' + lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function MassMessaging({ students, templates, user, onClose }) {
  const usable = templates.length ? templates : [];
  const [templateId, setTemplateId] = useState(usable[0]?.id ?? '');
  const [exported, setExported] = useState(false);

  const template = usable.find((t) => t.id === templateId) ?? usable[0];

  const handleExport = () => {
    if (!template) return;
    const rows = students.map((s) => ({
      name: s.name,
      phone: normalizeGuardianPhone(s.guardian_phone),
      message: renderTemplate(template.body, s)
    }));
    const now = new Date().toISOString().slice(0, 10);
    downloadCSV(rows, `رسائل_واتساب_${now}.csv`);
    setExported(true);
  };

  return (
    <Modal title="تصدير رسائل المجموعة" onClose={onClose}>
      {!usable.length && (
        <div className="alert error">لا توجد قوالب رسائل. أنشئ قالباً أولاً من زر «القوالب».</div>
      )}

      <div className="field">
        <label>القالب المستخدم</label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          disabled={exported}
        >
          {usable.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.is_locked ? ' (رسمي)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="alert ok" style={{ whiteSpace: 'pre-line' }}>
        {`عدد المستلمين: ${ar(students.length)}\nسيتم تصدير ملف CSV يحتوي على:\n• اسم الطالب\n• رقم ولي الأمر (بالصيغة الدولية)\n• نص الرسالة الجاهز`}
      </div>

      {exported && (
        <div className="alert ok">
          ✅ تم تصدير الملف. استورده يدوياً في خادم واتساب المحلي.
        </div>
      )}

      {!exported && (
        <button type="button" className="btn-primary" onClick={handleExport} disabled={!template} style={{ width: '100%' }}>
          📥 تحميل ملف CSV
        </button>
      )}

      {exported && (
        <button type="button" className="btn-primary" onClick={onClose} style={{ width: '100%' }}>
          تم، إغلاق
        </button>
      )}
    </Modal>
  );
}
