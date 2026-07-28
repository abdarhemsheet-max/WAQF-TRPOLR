import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { getLevelConfig, emptyEvaluation, CRITERIA } from '../utils/evaluationConfig.js';

export default function EvaluationModal({ student, user, onClose, onSaved }) {
  const config = getLevelConfig(student.level);
  const empty = emptyEvaluation(student.level);
  const [checks, setChecks] = useState(empty);
  const [voice, setVoice] = useState(student.voice_rating ?? 0);
  const evalIdRef = useRef(null);
  const checksRef = useRef(checks);
  const voiceRef = useRef(voice);
  const voiceTimer = useRef(null);

  useEffect(() => { checksRef.current = checks; }, [checks]);
  useEffect(() => { voiceRef.current = voice; }, [voice]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const save = useCallback(async () => {
    const payload = { criteria_data: checksRef.current, voice_rating: Number(voiceRef.current) };
    if (evalIdRef.current) {
      await supabase.from('evaluations').update(payload).eq('id', evalIdRef.current);
    } else {
      const { data: inserted } = await supabase.from('evaluations').insert({
        student_id: student.id, teacher_id: user?.id ?? null,
        level: student.level, ...payload
      }).select('id').single();
      if (inserted) evalIdRef.current = inserted.id;
    }
  }, [student.id, user?.id, student.level]);

  const toggle = (subject, row, criterion) => {
    const next = { ...checksRef.current };
    if (!next[subject]) next[subject] = [];
    next[subject] = next[subject].map((r, i) =>
      i === row ? { ...r, [criterion]: !r[criterion] } : r
    );
    checksRef.current = next;
    setChecks(next);
    save();
  };

  const handleVoiceChange = (e) => {
    const v = e.target.value;
    setVoice(v);
    clearTimeout(voiceTimer.current);
    voiceTimer.current = setTimeout(save, 400);
  };

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
