import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { ar } from '../utils/numbers.js';
import { computeFinalScore, totalDeductionAmount, VOICE_MAX } from '../utils/qualificationConfig.js';
const AR = VOICE_MAX;

const QUESTIONS = [
  {
    key: 'memorization', label: 'السؤال الأول: الحفظ',
    desc: 'تقييم حفظ الطالب للمتن',
    criteria: ['التلعثم', 'التردد', 'النقص أو الزيادة'],
    base: 10
  },
  {
    key: 'tajweed', label: 'السؤال الثاني: التجويد والأداء',
    desc: 'تقييم أحكام التجويد والأداء',
    criteria: ['اللحن الخفي', 'اللحن', 'التنبيه'],
    base: 10
  },
  {
    key: 'voice', label: 'السؤال الثالث: الصوت',
    desc: 'تقييم جودة الصوت والأداء',
    criteria: [], base: 10
  }
];

const DEDUCTION_VALUES = {
  التلعثم: 1.5, التردد: 3, 'النقص أو الزيادة': 3,
  'اللحن الخفي': 1.5, اللحن: 6, التنبيه: 6
};

function emptyDeductions() {
  const d = {};
  for (const q of QUESTIONS) {
    for (const c of q.criteria) d[c] = 0;
  }
  return d;
}

export default function FinalsEvaluationLockdown({ queueItem, user, onSubmitted }) {
  const [deductions, setDeductions] = useState(emptyDeductions);
  const [voiceScore, setVoiceScore] = useState(0);
  const [currentSection, setCurrentSection] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handlePopState = (e) => { e.preventDefault(); window.history.pushState(null, '', window.location.href); };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') e.preventDefault();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const inc = (key) => setDeductions(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
  const dec = (key) => setDeductions(prev => ({ ...prev, [key]: Math.max(0, (prev[key] || 0) - 1) }));

  const q1Deductions = useMemo(() => {
    const d = {};
    for (const c of QUESTIONS[0].criteria) d[c] = deductions[c] || 0;
    return d;
  }, [deductions]);

  const q2Deductions = useMemo(() => {
    const d = {};
    for (const c of QUESTIONS[1].criteria) d[c] = deductions[c] || 0;
    return d;
  }, [deductions]);

  const q1Score = useMemo(() => {
    const totalD = totalDeductionAmount(q1Deductions);
    return Math.max(0, QUESTIONS[0].base - totalD);
  }, [q1Deductions]);

  const q2Score = useMemo(() => {
    const totalD = totalDeductionAmount(q2Deductions);
    return Math.max(0, QUESTIONS[1].base - totalD);
  }, [q2Deductions]);

  const totalScore = useMemo(() => {
    const sum = q1Score + q2Score + Number(voiceScore);
    return Math.round((sum / 30) * 100);
  }, [q1Score, q2Score, voiceScore]);

  const allFilled = currentSection < 2 || (currentSection === 2 && voiceScore > 0);

  const handleSubmit = async () => {
    setSaving(true);
    const finalScore = computeFinalScore(voiceScore, deductions);

    const payload = {
      queue_id: queueItem.id,
      student_id: queueItem.student_id || null,
      finals_student_id: queueItem.finals_student_id || null,
      evaluator_id: user.id,
      voice_score: Number(voiceScore),
      deductions,
      final_score: finalScore
    };

    const { error } = await supabase.from('qualification_evaluations').insert(payload);
    if (error) { alert('فشل الحفظ: ' + error.message); setSaving(false); return; }

    const allEvals = [...(queueItem.evaluations || []), payload];
    const committeeSize = (queueItem.committee_member_count || 2);
    if (allEvals.length >= committeeSize) {
      await supabase.from('committee_queue').update({
        status: 'evaluated', evaluated_at: new Date().toISOString()
      }).eq('id', queueItem.id);
    }

    onSubmitted(payload);
  };

  const section = QUESTIONS[currentSection];
  const scoreColor = totalScore >= 80 ? '#6ee7b7' : totalScore >= 60 ? '#fcd34d' : '#fca5a5';

  return (
    <div className="eval-fullscreen" style={{ zIndex: 9999 }}>
      <div className="eval-header">
        <div className="eval-header-title">
          <span className="eval-header-name">تحكيم: {queueItem.student?.name || 'الطالب'}</span>
          <span className="eval-header-level">{queueItem.student?.level} · {queueItem.student?.matn}</span>
        </div>
        <div className="eval-score-badge" style={{ background: `${scoreColor}1A`, borderColor: `${scoreColor}40`, color: scoreColor }}>
          {ar(totalScore)}%
        </div>
      </div>

      <div style={{
        display: 'flex', gap: 8, padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(0,0,0,0.15)'
      }}>
        {QUESTIONS.map((q, i) => {
          const isDone = i < currentSection || (i === currentSection && allFilled);
          return (
            <button key={q.key} onClick={() => setCurrentSection(i)}
              className={`btn-action ${i === currentSection ? 'add' : ''}`}
              style={{
                flex: 1, justifyContent: 'center', fontSize: '0.82rem',
                background: i === currentSection ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                borderColor: i === currentSection ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)',
                color: i === currentSection ? '#93c5fd' : 'var(--text-muted)'
              }}>
              {isDone ? '✓ ' : ''}{q.label}
            </button>
          );
        })}
      </div>

      <div className="eval-table-area">
        <div className="glass-panel" style={{ maxWidth: 700, margin: '0 auto' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: 4 }}>{section.label}</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 16 }}>{section.desc}</p>

          {section.key === 'voice' ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
                قيّم صوت الطالب وأداءه من {AR}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <input type="number" min="0" max="10" step="0.5" value={voiceScore}
                  onChange={e => setVoiceScore(Math.min(10, Math.max(0, Number(e.target.value) || 0)))}
                  style={{
                    width: 80, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)',
                    color: 'var(--text-main)', padding: '10px 12px', borderRadius: 12, textAlign: 'center',
                    fontSize: '1.3rem', fontWeight: 700, direction: 'ltr'
                  }}
                  autoFocus
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>/ {AR}</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {section.criteria.map(key => {
                const count = deductions[key] || 0;
                const val = DEDUCTION_VALUES[key] || 0;
                return (
                  <div key={key} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '10px 14px',
                    border: '1px solid rgba(255,255,255,0.06)'
                  }}>
                    <button onClick={() => dec(key)}
                      className="btn-action edit-btn"
                      style={{ padding: '6px 10px', opacity: count === 0 ? 0.3 : 1, fontSize: '1rem' }}
                      disabled={count === 0}>−</button>
                    <span style={{ flex: 1, fontSize: '0.9rem' }}>{key}</span>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem', minWidth: 28, textAlign: 'center' }}>{ar(count)}</span>
                    <button onClick={() => inc(key)}
                      className="btn-action edit-btn"
                      style={{ padding: '6px 10px', fontSize: '1rem' }}>+</button>
                    <span style={{ color: '#fca5a5', fontSize: '0.82rem', minWidth: 40, textAlign: 'left' }}>
                      -{val.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{
            marginTop: 20, padding: '14px 18px', borderRadius: 12,
            background: `${scoreColor}12`, border: `1px solid ${scoreColor}30`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ color: 'var(--text-muted)' }}>مجموع السؤال</span>
            <strong style={{ fontSize: '1.2rem', color: scoreColor }}>
              {section.key === 'voice' ? ar(voiceScore) : ar(Math.round(section.key === 'memorization' ? q1Score : q2Score))}
              /{AR}
            </strong>
          </div>

          {currentSection < QUESTIONS.length - 1 ? (
            <button className="btn-primary" onClick={() => setCurrentSection(s => s + 1)}
              style={{ marginTop: 20, width: 'auto', padding: '10px 40px' }}>
              التالي ←
            </button>
          ) : (
            <button className="btn-primary" onClick={handleSubmit} disabled={saving || !allFilled}
              style={{ marginTop: 20, width: 'auto', padding: '12px 48px', background: '#166534' }}>
              {saving ? 'جارٍ الحفظ...' : 'تسليم التقييم'}
            </button>
          )}
        </div>
      </div>

      <div className="eval-footer">
        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          {QUESTIONS.map((q, i) => {
            const s = q.key === 'voice' ? ar(voiceScore) : ar(Math.round(q.key === 'memorization' ? q1Score : q2Score));
            return `${q.label}: ${s}/${AR}${i < 2 ? ' | ' : ''}`;
          })}
        </span>
        <div className="eval-score-badge" style={{ background: `${scoreColor}1A`, borderColor: `${scoreColor}40`, color: scoreColor, padding: '6px 16px', fontSize: '0.9rem' }}>
          النتيجة النهائية: {ar(totalScore)}%
        </div>
      </div>
    </div>
  );
}
