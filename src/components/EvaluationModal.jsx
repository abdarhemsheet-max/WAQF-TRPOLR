import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { getLevelConfig, emptyEvaluation, CRITERIA } from '../utils/evaluationConfig.js';

const DRAFT_KEY = (id) => `eval_draft_${id}`;

function loadDraft(studentId) {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(studentId));
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (draft?.criteria_data && Object.keys(draft.criteria_data).length) return draft;
  } catch {}
  return null;
}

function saveDraft(studentId, data) {
  try {
    localStorage.setItem(DRAFT_KEY(studentId), JSON.stringify({ ...data, _synced: false }));
  } catch {}
}

function markSynced(studentId) {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(studentId));
    if (!raw) return;
    const draft = JSON.parse(raw);
    draft._synced = true;
    localStorage.setItem(DRAFT_KEY(studentId), JSON.stringify(draft));
  } catch {}
}

function isDraftUnsaved(studentId) {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(studentId));
    if (!raw) return false;
    const draft = JSON.parse(raw);
    return draft._synced === false;
  } catch { return false; }
}

export default function EvaluationModal({ student, user, onClose }) {
  const config = getLevelConfig(student.level);
  const empty = emptyEvaluation(student.level);

  const [checks, setChecks] = useState(empty);
  const [voice, setVoice] = useState(student.voice_rating ?? 0);
  const [status, setStatus] = useState('idle');

  const evalIdRef = useRef(null);
  const checksRef = useRef(checks);
  const voiceRef = useRef(voice);
  const voiceTimer = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => { checksRef.current = checks; }, [checks]);
  useEffect(() => { voiceRef.current = voice; }, [voice]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const remoteSave = useCallback(async () => {
    const payload = { criteria_data: checksRef.current, voice_rating: Number(voiceRef.current) };
    setStatus('saving');
    if (evalIdRef.current) {
      const { error } = await supabase.from('evaluations').update(payload).eq('id', evalIdRef.current);
      if (error) throw error;
    } else {
      const { data: inserted, error } = await supabase.from('evaluations').insert({
        student_id: student.id, teacher_id: user?.id ?? null,
        level: student.level, ...payload
      }).select('id').single();
      if (error) throw error;
      if (inserted) evalIdRef.current = inserted.id;
    }
    markSynced(student.id);
    if (mountedRef.current) setStatus('saved');
  }, [student.id, user?.id, student.level]);

  const retrySync = useCallback(async () => {
    const draft = loadDraft(student.id);
    if (!draft || draft._synced) return;
    checksRef.current = draft.criteria_data;
    voiceRef.current = draft.voice_rating ?? 0;
    setChecks(draft.criteria_data);
    setVoice(draft.voice_rating ?? 0);
    try {
      await remoteSave();
    } catch {
      if (mountedRef.current) setStatus('offline');
    }
  }, [student.id, remoteSave]);

  const hybridSave = useCallback(() => {
    const data = { criteria_data: checksRef.current, voice_rating: Number(voiceRef.current) };
    saveDraft(student.id, data);
    remoteSave().catch(() => {
      if (mountedRef.current) setStatus('offline');
    });
  }, [student.id, remoteSave]);

  // Load existing on mount
  useEffect(() => {
    (async () => {
      if (isDraftUnsaved(student.id)) {
        // هناك مسودة لم تُرسل — استعدها وحاول المزامنة
        const draft = loadDraft(student.id);
        if (draft) {
          checksRef.current = draft.criteria_data;
          setChecks(draft.criteria_data);
          if (draft.voice_rating != null) {
            voiceRef.current = draft.voice_rating;
            setVoice(draft.voice_rating);
          }
        }
        if (navigator.onLine) {
          await retrySync();
        } else {
          setStatus('offline');
        }
        return;
      }

      const { data } = await supabase
        .from('evaluations')
        .select('id, criteria_data, voice_rating')
        .eq('student_id', student.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        evalIdRef.current = data.id;
        if (data.criteria_data && Object.keys(data.criteria_data).length) {
          checksRef.current = data.criteria_data;
          setChecks(data.criteria_data);
        }
        if (data.voice_rating != null) {
          voiceRef.current = data.voice_rating;
          setVoice(data.voice_rating);
        }
        markSynced(student.id);
        setStatus('saved');
      }
    })();
  }, [student.id, retrySync]);

  // Auto-sync when coming back online
  useEffect(() => {
    const handleOnline = () => {
      if (isDraftUnsaved(student.id)) {
        retrySync();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [student.id, retrySync]);

  const toggle = (subject, row, criterion) => {
    const next = { ...checksRef.current };
    if (!next[subject]) next[subject] = [];
    next[subject] = next[subject].map((r, i) =>
      i === row ? { ...r, [criterion]: !r[criterion] } : r
    );
    checksRef.current = next;
    setChecks(next);
    hybridSave();
  };

  const handleVoiceChange = (e) => {
    const v = e.target.value;
    setVoice(v);
    clearTimeout(voiceTimer.current);
    voiceTimer.current = setTimeout(hybridSave, 400);
  };

  const statusText = {
    idle: '', saving: 'جاري الحفظ...', saved: 'تم الحفظ',
    offline: 'مسودة محلية — بلا اتصال'
  }[status];

  return (
    <div className="eval-fullscreen">
      <div className="eval-header">
        <button className="eval-close-btn" onClick={onClose} title="رجوع">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div className="eval-header-title">
          <span className="eval-header-name">تحكيم: {student.name}</span>
          <span className="eval-header-level">{config.label}</span>
        </div>
        {statusText && <span className={`eval-status eval-status--${status}`}>{statusText}</span>}
        {status === 'offline' && (
          <button className="eval-sync-btn" onClick={retrySync} title="محاولة المزامنة الآن">
            مزامنة
          </button>
        )}
      </div>

      <div className="eval-info">
        <span><span className="eval-info-label">المستوى:</span> {student.level}</span>
        <span><span className="eval-info-label">الإنجاز:</span> {Number(student.progress)}%</span>
        <span><span className="eval-info-label">المركز:</span> {student.memorization_center || '—'}</span>
      </div>

      <div className="eval-table-area">
        <div className="eval-table-wrap">
          <table className="eval-table">
            <thead>
              <tr>
                <th className="eval-rh">#</th>
                {config.subjects.map((subject) => (
                  <th key={subject} colSpan={3}>{subject}</th>
                ))}
              </tr>
              <tr>
                <th className="eval-rh"></th>
                {config.subjects.map((subject) =>
                  CRITERIA.map((c) => <th key={`${subject}-${c}`} className="eval-cr">{c}</th>)
                )}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: config.rowCount }, (_, row) => (
                <tr key={row}>
                  <td className="eval-rn">{row + 1 === 10 ? 'عشرة' : row + 1}</td>
                  {config.subjects.map((subject) =>
                    CRITERIA.map((criterion) => {
                      const checked = checks[subject]?.[row]?.[criterion] ?? false;
                      return (
                        <td key={`${subject}-${row}-${criterion}`}>
                          <label className="eval-cb-label">
                            <input type="checkbox" className="eval-cb" checked={checked}
                              onChange={() => toggle(subject, row, criterion)} />
                            <span className="eval-cb-visual"></span>
                          </label>
                        </td>
                      );
                    })
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="eval-footer">
        <div className="eval-voice">
          <label>تقييم الصوت</label>
          <div className="eval-voice-wrap">
            <input type="number" className="eval-voice-input" min="0" max="10" step="0.5"
              value={voice} onChange={handleVoiceChange} />
            <span className="eval-voice-unit">/10</span>
          </div>
        </div>
        <button className="eval-close-footer-btn" onClick={onClose}>إغلاق</button>
      </div>
    </div>
  );
}
