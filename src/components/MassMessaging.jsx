import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { getStatus } from '../lib/whatsappService.js';
import { ar } from '../utils/numbers.js';
import { normalizeGuardianPhone } from '../utils/phone.js';
import { renderTemplate } from '../utils/templates.js';
import Modal from './Modal.jsx';
import WhatsAppConnect from './WhatsAppConnect.jsx';

export default function MassMessaging({ students, templates, user, onClose }) {
  const usable = templates.length ? templates : [];
  const [templateId, setTemplateId] = useState(usable[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [note, setNote] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [wsSender, setWsSender] = useState('');
  const [showQR, setShowQR] = useState(false);

  const checkStatus = useCallback(() => {
    getStatus().then((d) => {
      setWsConnected(d.ready);
      setWsSender(d.sender || '');
    }).catch(() => setWsConnected(false));
  }, []);

  useEffect(() => {
    checkStatus();
    const id = setInterval(checkStatus, 5000);
    return () => clearInterval(id);
  }, [checkStatus]);

  const template = usable.find((t) => t.id === templateId) ?? usable[0];

  const saveToQueue = async () => {
    if (!template) return;

    if (!window.confirm(`تأكيد تجهيز ${ar(students.length)} رسالة وإرسالها إلى طابور السيرفر المحلي؟`)) return;

    setSaving(true);
    setDone(false);
    setNote('');

    const messages = students.map((s) => ({
      phone: normalizeGuardianPhone(s.guardian_phone),
      message: renderTemplate(template.body, s),
      student_name: s.name
    }));

    const batchId = crypto.randomUUID();

    const rows = messages.map((m) => ({
      batch_id: batchId,
      phone: m.phone,
      message: m.message,
      student_name: m.student_name,
      status: 'pending'
    }));

    try {
      const { error } = await supabase.from('messages_queue').insert(rows);
      if (error) {
        setNote('فشل حفظ الرسائل في Supabase: ' + error.message);
      } else {
        setNote(`✅ تم حفظ ${ar(rows.length)} رسالة في طابور الإرسال.\n\nالآن اذهب إلى الخادم المحلي:\nhttp://localhost:3001\nواضغط "إرسال الكل".`);
        setDone(true);
      }
    } catch (err) {
      setNote('خطأ: ' + (err.message || 'فشل الاتصال'));
    }

    setSaving(false);
  };

  return (
    <Modal title="المراسلة الجماعية" onClose={saving ? () => {} : onClose}>
      {!usable.length && (
        <div className="alert error">لا توجد قوالب رسائل. أنشئ قالباً أولاً من زر «القوالب».</div>
      )}

      <div className="field">
        <label>القالب المستخدم</label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          disabled={saving || done}
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
        {`عدد المستلمين: ${ar(students.length)}\nحالة واتساب: ${wsConnected ? '✅ متصل' : '❌ غير متصل'}${wsSender ? `\nرقم المُرسل: +${wsSender}` : ''}`}
      </div>

      {note && (
        <div className="alert ok" style={{ whiteSpace: 'pre-line' }}>{note}</div>
      )}

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 16, margin: '12px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <strong style={{ color: 'var(--text-main)' }}>طريقة العمل:</strong>
        <ol style={{ marginRight: 20, marginTop: 8, lineHeight: 2 }}>
          <li>اضغط "إرسال البيانات ← الخادم المحلي"</li>
          <li>يتم حفظ الرسائل في Supabase بحالة "قيد الانتظار"</li>
          <li>اذهب إلى <strong>http://localhost:3001</strong></li>
          <li>في الخادم المحلي، اضغط <strong>"🚀 إرسال الكل"</strong></li>
          <li>شاهد شريط التقدم في الخادم المحلي مباشرة</li>
        </ol>
      </div>

      {!saving && !done && (
        <button type="button" className="btn-primary" onClick={saveToQueue} disabled={!template} style={{ width: '100%' }}>
          📤 إرسال البيانات ← الخادم المحلي
        </button>
      )}

      {!wsConnected && !saving && !done && (
        <button className="btn-action whatsapp-all" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={() => setShowQR(true)}>
          ربط WhatsApp (لاختبار الاتصال)
        </button>
      )}

      {saving && (
        <div style={{ textAlign: 'center', padding: 12 }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</div>
          جاري حفظ الرسائل في قاعدة البيانات...
        </div>
      )}

      {done && (
        <button type="button" className="btn-primary" onClick={onClose} style={{ width: '100%' }}>
          تم، إغلاق
        </button>
      )}

      {showQR && (
        <WhatsAppConnect
          onClose={() => setShowQR(false)}
          onConnected={() => { setWsConnected(true); setShowQR(false); }}
        />
      )}
    </Modal>
  );
}
