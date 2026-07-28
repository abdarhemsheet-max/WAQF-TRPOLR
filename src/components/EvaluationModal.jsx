import { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { getLevelConfig, emptyEvaluation, computeTotalScore, DEDUCTIONS, CRITERIA, ROWS_LABELS } from '../utils/evaluationConfig.js';

const BTN_STYLES = {
  لحن: { label: 'لحن', activeBg: 'rgba(239,68,68,0.2)', activeBorder: 'rgba(239,68,68,0.5)', activeColor: '#fca5a5', deduct: `-${DEDUCTIONS.لحن}` },
  تنبيه: { label: 'تنبيه', activeBg: 'rgba(245,158,11,0.2)', activeBorder: 'rgba(245,158,11,0.5)', activeColor: '#fcd34d', deduct: `-${DEDUCTIONS.تنبيه}` },
  تلعثم: { label: 'تلعثم', activeBg: 'rgba(59,130,246,0.2)', activeBorder: 'rgba(59,130,246,0.5)', activeColor: '#93c5fd', deduct: `-${DEDUCTIONS.تلعثم}` },
};

export default function EvaluationModal({ student, user, onClose, onSaved }) {
  const config = getLevelConfig(student.level);
  const [checks, setChecks] = useState(() => emptyEvaluation(student.level));
  const [voice, setVoice] = useState(student.voice_rating ?? 0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const score = useMemo(() => computeTotalScore(checks, config.subjects), [checks, config.subjects]);

  const toggle = useCallback((subject, row, criterion) => {
    setChecks(prev => {
      const next = { ...prev };
      if (!next[subject]) next[subject] = [];
      next[subject] = next[subject].map((r, i) =>
        i === row ? { ...r, [criterion]: !r[criterion] } : r
      );
      return next;
    });
  }, []);

  const handleApprove = useCallback(async () => {
    setSaving(true);
    const { error } = await supabase.from('evaluations').insert({
      student_id: student.id,
      teacher_id: user?.id ?? null,
      level: student.level,
      voice_rating: Number(voice),
      criteria_data: checks,
      final_score: score,
      is_approved: true,
    });
    if (error) {
      alert('فشل الحفظ: ' + error.message);
      setSaving(false);
      return;
    }
    onSaved?.();
    onClose();
  }, [student.id, user?.id, student.level, voice, checks, score, onSaved, onClose]);

  const scoreColor = score >= 80 ? '#6ee7b7' : score >= 60 ? '#fcd34d' : '#fca5a5';

  return (
    <div className="eval-fullscreen">
      {/* Header */}
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
        <div className="eval-score-badge" style={{ background: `${scoreColor}1A`, borderColor: `${scoreColor}40`, color: scoreColor }}>
          النتيجة: {score}%
        </div>
      </div>

      {/* Info bar */}
      <div className="eval-info">
        <span><span className="eval-info-label">المستوى:</span> {student.level}</span>
        <span><span className="eval-info-label">الإنجاز:</span> {Number(student.progress)}%</span>
        <span><span className="eval-info-label">المركز:</span> {student.memorization_center || '—'}</span>
      </div>

      {/* Table */}
      <div className="eval-table-area">
        <div className="eval-table-wrap">
          <table className="eval-table">
            <thead>
              <tr>
                <th className="eval-rh">#</th>
                {config.subjects.map(subject => (
                  <th key={subject} colSpan={3}>{subject}</th>
                ))}
              </tr>
              <tr>
                <th className="eval-rh"></th>
                {config.subjects.map(subject =>
                  CRITERIA.map(c => <th key={`${subject}-${c}`} className="eval-cr">{BTN_STYLES[c].label}</th>)
                )}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: config.rowCount }, (_, row) => (
                <tr key={row}>
                  <td className="eval-rn">{row + 1 === 10 ? 'عشرة' : row + 1}</td>
                  {config.subjects.map(subject =>
                    CRITERIA.map(criterion => {
                      const active = checks[subject]?.[row]?.[criterion] ?? false;
                      const s = BTN_STYLES[criterion];
                      return (
                        <td key={`${subject}-${row}-${criterion}`}>
                          <button
                            onClick={() => toggle(subject, row, criterion)}
                            className="eval-btn"
                            style={{
                              background: active ? s.activeBg : 'rgba(255,255,255,0.04)',
                              borderColor: active ? s.activeBorder : 'rgba(255,255,255,0.1)',
                              color: active ? s.activeColor : 'rgba(255,255,255,0.35)',
                              boxShadow: active ? `0 0 12px ${s.activeBorder}` : 'none',
                            }}
                            title={active ? `إزالة (${s.deduct})` : `إضافة (${s.deduct})`}
                          >
                            {active ? s.label : <span style={{ opacity: 0.4 }}>-</span>}
                          </button>
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

      {/* Footer */}
      <div className="eval-footer">
        <div className="eval-footer-left">
          <div className="eval-voice">
            <label>تقييم الصوت</label>
            <div className="eval-voice-wrap">
              <input type="number" className="eval-voice-input" min="0" max="10" step="0.5"
                value={voice} onChange={e => setVoice(e.target.value)} />
              <span className="eval-voice-unit">/10</span>
            </div>
          </div>
        </div>
        <div className="eval-footer-right">
          <button className="eval-approve-btn" onClick={handleApprove} disabled={saving || score === 0}
            style={{ background: scoreColor }}>
            {saving ? 'جارٍ الحفظ...' : 'اعتماد النتيجة'}
          </button>
          <button className="eval-close-footer-btn" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}
