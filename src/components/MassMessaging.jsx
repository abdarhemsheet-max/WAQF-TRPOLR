import { useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { writeWithFallback } from '../lib/offlineQueue.js';
import { ar } from '../utils/numbers.js';
import { displayGuardianPhone, normalizeGuardianPhone } from '../utils/phone.js';
import { renderTemplate } from '../utils/templates.js';
import { guardianLink, massMessagingWarning } from '../utils/whatsapp.js';
import Modal from './Modal.jsx';

/** الفاصل الزمني بين كل محادثة والتالية — يمنع تجميد الواجهة وحجب المتصفح للنوافذ */
const SEND_DELAY_MS = 1500;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * المراسلة الجماعية.
 *
 * قناة الإرسال هي روابط wa.me، ولذلك:
 *  - "فُتحت"  = المتصفح فتح المحادثة فعلاً (window.open أعاد مرجع نافذة).
 *  - "محجوبة" = المتصفح منع النافذة المنبثقة (window.open أعاد null) — فشل حقيقي.
 * فتح المحادثة لا يعني وصول الرسالة؛ الإرسال يتم بضغطة المستخدم داخل واتساب.
 * لهذا لا يوجد في هذا النظام حقل يسمّى "نسبة نجاح الإرسال".
 */
export default function MassMessaging({ students, templates, user, onClose, onArchived }) {
  const usable = templates.length ? templates : [];
  const [templateId, setTemplateId] = useState(usable[0]?.id ?? '');
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState([]);
  const [archiveNote, setArchiveNote] = useState('');
  const cancelRef = useRef(false);

  const template = usable.find((t) => t.id === templateId) ?? usable[0];
  const processed = results.length;
  const opened = results.filter((r) => r.status === 'opened').length;
  const blocked = results.filter((r) => r.status === 'blocked').length;
  const percent = students.length ? Math.round((processed / students.length) * 100) : 0;

  /** أرشفة التقرير — أمر واحد مباشر بلا مسودات ولا مراحل مراجعة */
  const archiveReport = async (runResults, startedAt) => {
    const report = {
      teacher_id: user.role === 'teacher' ? user.id : null,
      teacher_name: user.name,
      template_name: template?.name ?? '',
      total_count: students.length,
      opened_count: runResults.filter((r) => r.status === 'opened').length,
      blocked_count: runResults.filter((r) => r.status === 'blocked').length,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      details: runResults
    };

    const { deferred, error } = await writeWithFallback({
      table: 'message_reports',
      action: 'insert',
      payload: report
    });

    if (deferred) {
      setArchiveNote('لا يوجد اتصال — حُفظ التقرير محلياً وسيُرفع تلقائياً عند عودة الشبكة.');
    } else if (error) {
      setArchiveNote('تعذّرت أرشفة التقرير: ' + error.message);
    } else {
      setArchiveNote('تم أرشفة التقرير في قاعدة البيانات.');
    }

    onArchived?.();
  };

  const run = async () => {
    if (!template) return;
    if (!window.confirm(massMessagingWarning(students) + '\n\nهل تريد المتابعة؟')) return;

    cancelRef.current = false;
    setRunning(true);
    setFinished(false);
    setResults([]);
    setArchiveNote('');

    const startedAt = new Date().toISOString();
    const collected = [];

    // حلقة for...of كما هو مطلوب: عنصر واحد في كل دورة مع فاصل زمني
    for (const student of students) {
      if (cancelRef.current) break;

      const phone = normalizeGuardianPhone(student.guardian_phone);

      try {
        const message = renderTemplate(template.body, student);
        const win = window.open(guardianLink(student, template.body), '_blank');

        // window.open يعيد null حين يحجب المتصفح النافذة — وهذا فشل حقيقي
        if (!win) throw new Error('حجب المتصفح النافذة المنبثقة');

        collected.push({
          student_id: student.id,
          name: student.name,
          phone: phone || null,
          status: 'opened',
          chars: message.length,
          at: new Date().toISOString()
        });
      } catch (thrown) {
        // الخطأ لا يوقف بقية الرسائل
        collected.push({
          student_id: student.id,
          name: student.name,
          phone: phone || null,
          status: 'blocked',
          error: String(thrown.message ?? thrown),
          at: new Date().toISOString()
        });
      }

      setResults([...collected]);
      await delay(SEND_DELAY_MS);
    }

    setRunning(false);
    setFinished(true);
    await archiveReport(collected, startedAt);
  };

  const cancel = () => {
    cancelRef.current = true;
  };

  return (
    <Modal title="المراسلة الجماعية" onClose={running ? () => {} : onClose}>
      {!usable.length && (
        <div className="alert error">لا توجد قوالب رسائل. أنشئ قالباً أولاً من زر «القوالب».</div>
      )}

      <div className="field">
        <label>القالب المستخدم</label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          disabled={running || finished}
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
        {`عدد المستلمين: ${ar(students.length)}\nفاصل زمني بين كل محادثة: ثانية ونصف\nفتح المحادثة لا يُرسل الرسالة — تضغط «إرسال» داخل واتساب.`}
      </div>

      {(running || finished) && (
        <>
          <div className="mass-progress">
            <div className="mass-progress-head">
              <span>
                {running ? 'جارٍ فتح المحادثات...' : 'انتهت العملية'} — {ar(processed)} من{' '}
                {ar(students.length)}
              </span>
              <strong>{ar(percent)}%</strong>
            </div>
            <div className="progress-bar-bg">
              <div
                className="progress-bar-fill"
                style={{ width: `${percent}%`, background: 'var(--primary)' }}
              />
            </div>
          </div>

          <div className="mass-counters">
            <div className="mass-counter ok">
              <span className="label">محادثات فُتحت</span>
              <span className="value">{ar(opened)}</span>
            </div>
            <div className="mass-counter bad">
              <span className="label">حجبها المتصفح</span>
              <span className="value">{ar(blocked)}</span>
            </div>
          </div>

          <div className="mass-log">
            {results.map((r) => (
              <div className={`mass-log-row ${r.status}`} key={r.student_id}>
                <span className="mass-log-name">{r.name}</span>
                <span className="mass-log-phone">
                  {r.phone ? displayGuardianPhone(r.phone) : 'بلا رقم'}
                </span>
                <span className="mass-log-status">
                  {r.status === 'opened' ? 'فُتحت' : `محجوبة — ${r.error}`}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {archiveNote && <div className="alert ok">{archiveNote}</div>}

      {!running && !finished && (
        <button type="button" className="btn-primary" onClick={run} disabled={!template}>
          بدء المراسلة
        </button>
      )}

      {running && (
        <button type="button" className="btn-primary" onClick={cancel}>
          إيقاف بعد المحادثة الحالية
        </button>
      )}

      {finished && (
        <button type="button" className="btn-primary" onClick={onClose}>
          إغلاق
        </button>
      )}
    </Modal>
  );
}
