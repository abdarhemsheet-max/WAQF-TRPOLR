import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { getStatus, sendBulkStream } from '../lib/whatsappService.js';
import { ar } from '../utils/numbers.js';
import { displayGuardianPhone, normalizeGuardianPhone } from '../utils/phone.js';
import { renderTemplate } from '../utils/templates.js';
import Modal from './Modal.jsx';
import WhatsAppConnect from './WhatsAppConnect.jsx';

export default function MassMessaging({ students, templates, user, onClose, onArchived }) {
  const usable = templates.length ? templates : [];
  const [templateId, setTemplateId] = useState(usable[0]?.id ?? '');
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState([]);
  const [archiveNote, setArchiveNote] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [wsSender, setWsSender] = useState('');
  const [showQR, setShowQR] = useState(false);
  const cancelRef = useRef(false);
  const abortRef = useRef(null);

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
  const processed = results.length;
  const sent = results.filter((r) => r.status === 'sent').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const percent = students.length ? Math.round((processed / students.length) * 100) : 0;

  const archiveReport = async (runResults, startedAt) => {
    const report = {
      teacher_id: user.role === 'teacher' ? user.id : null,
      teacher_name: user.name,
      template_name: template?.name ?? '',
      total_count: students.length,
      opened_count: runResults.filter((r) => r.status === 'sent').length,
      blocked_count: runResults.filter((r) => r.status === 'failed').length,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      details: runResults
    };

    try {
      const { error } = await supabase.from('message_reports').insert(report);
      if (error) {
        setArchiveNote('تعذّرت أرشفة التقرير: ' + error.message);
      } else {
        setArchiveNote('تم أرشفة التقرير في قاعدة البيانات.');
      }
    } catch {
      setArchiveNote('تعذّرت أرشفة التقرير.');
    }

    onArchived?.();
  };

  const run = async () => {
    if (!template) return;
    if (!wsConnected) {
      setShowQR(true);
      return;
    }

    if (!window.confirm(`تأكيد إرسال ${ar(students.length)} رسالة عبر WhatsApp Web?\n\nسيتم إرسال الرسائل تلقائياً بفاصل زمني.`)) return;

    cancelRef.current = false;
    setRunning(true);
    setFinished(false);
    setResults([]);
    setArchiveNote('');

    const startedAt = new Date().toISOString();
    const collected = [];

    const messages = students.map((s) => ({
      student_id: s.id,
      name: s.name,
      phone: normalizeGuardianPhone(s.guardian_phone),
      message: renderTemplate(template.body, s)
    }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await sendBulkStream(messages, (data) => {
        if (data.type === 'sent' || data.type === 'failed') {
          collected.push({
            student_id: data.student_id,
            name: data.name,
            phone: data.phone,
            status: data.type,
            error: data.error || null,
            at: new Date().toISOString()
          });
          setResults([...collected]);
        }
        if (data.type === 'done') {
          setResults(data.results);
        }
      });
    } catch (thrown) {
      if (cancelRef.current) {
        collected.push(...messages.slice(collected.length).map((m) => ({
          student_id: m.student_id,
          name: m.name,
          phone: m.phone,
          status: 'cancelled',
          error: 'أُلغي من المستخدم',
          at: new Date().toISOString()
        })));
        setResults([...collected]);
      } else {
        collected.push(...messages.slice(collected.length).map((m) => ({
          student_id: m.student_id,
          name: m.name,
          phone: m.phone,
          status: 'failed',
          error: String(thrown.message ?? thrown),
          at: new Date().toISOString()
        })));
        setResults([...collected]);
      }
    }

    setRunning(false);
    setFinished(true);
    await archiveReport(collected, startedAt);
  };

  const cancel = () => {
    cancelRef.current = true;
    if (abortRef.current) {
      abortRef.current.abort();
    }
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
        {`عدد المستلمين: ${ar(students.length)}\nفاصل زمني بين كل رسالة: 1.5 ثانية\nحالة واتساب: ${wsConnected ? '✅ متصل' : '❌ غير متصل'}${wsSender ? `\nرقم المُرسل: +${wsSender}` : ''}`}
      </div>

      {!wsConnected && !running && !finished && (
        <button className="btn-action whatsapp-all" style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }} onClick={() => setShowQR(true)}>
          ربط WhatsApp
        </button>
      )}

      {(running || finished) && (
        <>
          <div className="mass-progress">
            <div className="mass-progress-head">
              <span>
                {running ? 'جارٍ الإرسال...' : 'انتهت العملية'} — {ar(processed)} من{' '}
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
              <span className="label">أُرسلت بنجاح</span>
              <span className="value">{ar(sent)}</span>
            </div>
            <div className="mass-counter bad">
              <span className="label">فشل الإرسال</span>
              <span className="value">{ar(failed)}</span>
            </div>
          </div>

          <div className="mass-log">
            {results.map((r, i) => (
              <div className={`mass-log-row ${r.status === 'sent' ? 'opened' : r.status === 'cancelled' ? 'blocked' : 'blocked'}`} key={r.student_id || i}>
                <span className="mass-log-name">{r.name}</span>
                <span className="mass-log-phone">
                  {r.phone ? displayGuardianPhone(r.phone) : 'بلا رقم'}
                </span>
                <span className="mass-log-status">
                  {r.status === 'sent' ? 'أُرسلت' : r.status === 'cancelled' ? 'أُلغي' : `فشل — ${r.error || ''}`}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {archiveNote && <div className="alert ok">{archiveNote}</div>}

      {!running && !finished && (
        <button type="button" className="btn-primary" onClick={run} disabled={!template}>
          {wsConnected ? 'بدء الإرسال' : 'ربط WhatsApp أولاً'}
        </button>
      )}

      {running && (
        <button type="button" className="btn-primary" onClick={cancel} style={{ background: 'var(--danger)' }}>
          ⏹ إيقاف الإرسال
        </button>
      )}

      {finished && (
        <button type="button" className="btn-primary" onClick={onClose}>
          إغلاق
        </button>
      )}

      {showQR && (
        <WhatsAppConnect
          onClose={() => setShowQR(false)}
          onConnected={() => {
            setWsConnected(true);
            setShowQR(false);
          }}
        />
      )}
    </Modal>
  );
}
