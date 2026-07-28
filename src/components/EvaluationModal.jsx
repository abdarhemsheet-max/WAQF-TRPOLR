import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { getLevelConfig, emptyEvaluation, CRITERIA, ROWS } from '../utils/evaluationConfig.js';

export default function EvaluationModal({ student, user, onClose, onSaved }) {
  const config = getLevelConfig(student.level);
  const [checks, setChecks] = useState(() => {
    try {
      return JSON.parse(student.criteria_data ?? '{}');
    } catch {
      return emptyEvaluation(student.level);
    }
  });
  const [voice, setVoice] = useState(student.voice_rating ?? 0);
  const [saving, setSaving] = useState(false);

  const toggle = (subject, row, criterion) => {
    setChecks((prev) => {
      const next = { ...prev };
      if (!next[subject]) {
        next[subject] = [];
      }
      next[subject] = next[subject].map((r, i) =>
        i === row ? { ...r, [criterion]: !r[criterion] } : r
      );
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from('evaluations').insert({
      student_id: student.id,
      teacher_id: user?.id ?? null,
      level: student.level,
      voice_rating: voice,
      criteria_data: checks
    });
    if (error) {
      alert('تعذّر حفظ التقييم: ' + error.message);
    } else {
      onSaved?.();
      onClose();
    }
    setSaving(false);
  };

  return (
    <div className="eval-fullscreen">
      {/* Sticky header */}
      <div className="eval-header">
        <button className="eval-close-btn" onClick={onClose} title="رجوع">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div className="eval-header-title">
          <span className="eval-header-name">تحكيم: {student.name}</span>
          <span className="eval-header-level">{config.label}</span>
        </div>
      </div>

      {/* Info bar */}
      <div className="eval-info">
        <span><span className="eval-info-label">المستوى:</span> {student.level}</span>
        <span><span className="eval-info-label">الإنجاز:</span> {Number(student.progress)}%</span>
        <span><span className="eval-info-label">المركز:</span> {student.memorization_center || '—'}</span>
      </div>

      {/* Scrollable table area */}
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
                            <input
                              type="checkbox"
                              className="eval-cb"
                              checked={checked}
                              onChange={() => toggle(subject, row, criterion)}
                            />
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

      {/* Sticky footer */}
      <div className="eval-footer">
        <div className="eval-voice">
          <label>تقييم الصوت</label>
          <div className="eval-voice-wrap">
            <input
              type="number"
              className="eval-voice-input"
              min="0"
              max="10"
              step="0.5"
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
            />
            <span className="eval-voice-unit">/10</span>
          </div>
        </div>
        <button className="eval-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? 'جارٍ الحفظ...' : 'حفظ التقييم'}
        </button>
      </div>
    </div>
  );
}
