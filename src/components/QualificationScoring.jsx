import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { DEDUCTION_KEYS, QUAL_DEDUCTIONS, computeFinalScore, totalDeductionAmount, VOICE_MAX } from '../utils/qualificationConfig.js';
import { ar } from '../utils/numbers.js';

export default function QualificationScoring({ queueItem, user, onClose, onSaved }) {
  const [deductions, setDeductions] = useState({});
  const [voiceScore, setVoiceScore] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedEval, setSavedEval] = useState(null);

  const totalDeduct = useMemo(() => totalDeductionAmount(deductions), [deductions]);
  const finalScore = useMemo(() => computeFinalScore(voiceScore, deductions), [voiceScore, deductions]);

  const inc = (key) => setDeductions(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
  const dec = (key) => setDeductions(prev => ({ ...prev, [key]: Math.max(0, (prev[key] || 0) - 1) }));

  const handleSave = async () => {
    setSaving(true);
    const { error: dbErr } = await supabase.from('qualification_evaluations').insert({
      queue_id: queueItem.id,
      student_id: queueItem.student_id,
      evaluator_id: user.id,
      voice_score: Number(voiceScore),
      deductions,
      final_score: finalScore
    });
    if (dbErr) { alert('فشل الحفظ: ' + dbErr.message); setSaving(false); return; }

    await supabase.from('committee_queue').update({ status: 'evaluated', evaluated_at: new Date().toISOString() }).eq('id', queueItem.id);

    setSavedEval({ voice_score: Number(voiceScore), deductions, final_score: finalScore });
    onSaved?.();
  };

  if (savedEval) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>✅</div>
        <h2 style={{ marginBottom: 8 }}>تم تسليم التقييم</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
          {queueItem.student?.name} — النتيجة: {ar(Math.round(finalScore))}%
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <button className="btn-action" onClick={onClose}>رجوع</button>
        </div>
      </div>
    );
  }

  const scoreColor = finalScore >= 80 ? '#6ee7b7' : finalScore >= 60 ? '#fcd34d' : '#fca5a5';

  return (
    <div className="glass-panel">
      <div className="glass-panel-head">
        <div>
          <h2>تقييم: {queueItem.student?.name || 'الطالب'}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            {queueItem.student?.level} · {queueItem.student?.matn}
          </p>
        </div>
        <div style={{
          padding: '8px 20px', borderRadius: 20, border: '1px solid',
          background: `${scoreColor}1A`, borderColor: `${scoreColor}40`,
          color: scoreColor, fontWeight: 700, fontSize: '1.1rem'
        }}>
          {ar(Math.round(finalScore))}%
        </div>
      </div>

      <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ margin: 0, whiteSpace: 'nowrap' }}>تقييم الصوت والأداء (من {VOICE_MAX}):</label>
        <input type="number" min="0" max="10" step="0.5" value={voiceScore}
          onChange={e => setVoiceScore(Math.min(10, Math.max(0, Number(e.target.value) || 0)))}
          style={{ width: 72, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)',
            color: 'var(--text-main)', padding: '8px 10px', borderRadius: 10, textAlign: 'center', direction: 'ltr' }}
        />
        <span style={{ color: 'var(--text-muted)' }}>/ {VOICE_MAX}</span>
      </div>

      <div style={{ margin: '16px 0', padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 8 }}>
          الخصم من 90 درجة — الصوت والأداء يضاف من {VOICE_MAX}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {DEDUCTION_KEYS.map(key => {
            const count = deductions[key] || 0;
            const deductVal = QUAL_DEDUCTIONS[key];
            return (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '6px 10px',
                border: '1px solid rgba(255,255,255,0.06)'
              }}>
                <button onClick={() => dec(key)}
                  className="btn-action edit-btn"
                  style={{ padding: '4px 8px', opacity: count === 0 ? 0.3 : 1 }}
                  disabled={count === 0}>−</button>
                <span style={{ flex: 1, fontSize: '0.82rem' }}>{key}</span>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', minWidth: 24, textAlign: 'center' }}>{ar(count)}</span>
                <button onClick={() => inc(key)}
                  className="btn-action edit-btn"
                  style={{ padding: '4px 8px' }}>+</button>
                <span style={{ color: '#fca5a5', fontSize: '0.78rem', minWidth: 36, textAlign: 'left' }}>
                  -{deductVal}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 16px', borderRadius: 12,
        background: `${scoreColor}12`, border: `1px solid ${scoreColor}30`, flexWrap: 'wrap', gap: 8
      }}>
        <div>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>إجمالي الخصم: </span>
          <strong style={{ color: '#fca5a5' }}>-{totalDeduct.toFixed(1)}</strong>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginRight: 16 }}>الصوت: </span>
          <strong style={{ color: '#93c5fd' }}>+{ar(voiceScore)}</strong>
        </div>
        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: scoreColor }}>
          = {ar(Math.round(finalScore))}%
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ width: 'auto', padding: '10px 32px' }}>
          {saving ? 'جارٍ الحفظ...' : 'تسليم التقييم'}
        </button>
        <button className="btn-action" onClick={onClose} style={{ padding: '10px 24px' }}>إلغاء</button>
      </div>
    </div>
  );
}
