import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import Modal from './Modal.jsx';
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
    <Modal title={`تحكيم: ${student.name}`} onClose={onClose} wide>
      <div className="evaluation-modal-body">
        <div className="evaluation-info">
          <div><span className="evaluation-info-label">المستوى:</span> {student.level}</div>
          <div><span className="evaluation-info-label">نسبة الإنجاز:</span> {Number(student.progress)}%</div>
          <div><span className="evaluation-info-label">مركز التحفيظ:</span> {student.memorization_center || '—'}</div>
        </div>

        <div className="evaluation-table-wrap">
          <table className="evaluation-table">
            <thead>
              <tr>
                <th className="eval-row-header">#</th>
                {config.subjects.map((subject) => (
                  <th key={subject} colSpan={3}>{subject}</th>
                ))}
              </tr>
              <tr>
                <th className="eval-row-header"></th>
                {config.subjects.map((subject) =>
                  CRITERIA.map((c) => <th key={`${subject}-${c}`} className="eval-criterion">{c}</th>)
                )}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: config.rowCount }, (_, row) => (
                <tr key={row}>
                  <td className="eval-row-num">{row + 1 === 10 ? 'عشرة' : row + 1}</td>
                  {config.subjects.map((subject) =>
                    CRITERIA.map((criterion) => {
                      const checked = checks[subject]?.[row]?.[criterion] ?? false;
                      return (
                        <td key={`${subject}-${row}-${criterion}`}>
                          <div className="check-item">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(subject, row, criterion)}
                            />
                          </div>
                        </td>
                      );
                    })
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="evaluation-footer">
          <div className="evaluation-voice">
            <label>تقييم الصوت</label>
            <div className="voice-rating-wrap">
              <input
                type="number"
                className="voice-input"
                min="0"
                max="10"
                step="0.5"
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
              />
              <span className="progress-sign">/10</span>
            </div>
          </div>
          <button className="btn-primary evaluation-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'جارٍ الحفظ...' : 'حفظ التقييم'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
