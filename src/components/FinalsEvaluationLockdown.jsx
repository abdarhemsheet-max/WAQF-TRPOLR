import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { ar } from '../utils/numbers.js';
import { DEDUCTION_KEYS, QUAL_DEDUCTIONS, totalDeductionAmount, VOICE_MAX } from '../utils/qualificationConfig.js';

const DEDUCTION_VALUES = QUAL_DEDUCTIONS;
const MAX_PER_QUESTION = 20;

function emptyDeductions() {
  return Object.fromEntries(DEDUCTION_KEYS.map(k => [k, 0]));
}

function questionScore(voiceScore, deductions) {
  const ded = totalDeductionAmount(deductions);
  return Math.max(0, 10 - ded + Number(voiceScore));
}

function totalPercentage(questions) {
  if (questions.length === 0) return 0;
  const total = questions.reduce((s, q) => s + questionScore(q.voiceScore, q.deductions), 0);
  return Math.round((total / (questions.length * MAX_PER_QUESTION)) * 100);
}

function labelForIndex(i) {
  const names = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'];
  return `السؤال ${names[i] || i + 1}`;
}

export default function FinalsEvaluationLockdown({ queueItem, user, onSubmitted }) {
  const [questions, setQuestions] = useState([{ index: 0, voiceScore: 0, deductions: emptyDeductions() }]);
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

  const addQuestion = () => {
    setQuestions(prev => [...prev, { index: prev.length, voiceScore: 0, deductions: emptyDeductions() }]);
  };

  const updateVoice = (idx, val) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, voiceScore: Math.min(10, Math.max(0, Number(val) || 0)) } : q));
  };

  const inc = (idx, key) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, deductions: { ...q.deductions, [key]: (q.deductions[key] || 0) + 1 } } : q));
  };

  const dec = (idx, key) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, deductions: { ...q.deductions, [key]: Math.max(0, (q.deductions[key] || 0) - 1) } } : q));
  };

  const totalScore = useMemo(() => totalPercentage(questions), [questions]);
  const section = questions[currentSection];

  const handleSubmit = async () => {
    setSaving(true);

    const questionsPayload = questions.map(q => ({
      question_index: q.index,
      voice_score: Number(q.voiceScore),
      deductions: q.deductions
    }));

    const totalVoice = questions.reduce((s, q) => s + Number(q.voiceScore), 0);

    const finalScore = totalPercentage(questions);

    const payload = {
      queue_id: queueItem.id,
      student_id: queueItem.student_id || null,
      finals_student_id: queueItem.finals_student_id || null,
      evaluator_id: user.id,
      voice_score: totalVoice,
      deductions: questionsPayload,
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
        background: 'rgba(0,0,0,0.15)', overflowX: 'auto', flexWrap: 'wrap'
      }}>
        {questions.map((q, i) => {
          const sq = questionScore(q.voiceScore, q.deductions);
          const isDone = sq > 0;
          return (
            <button key={i} onClick={() => setCurrentSection(i)}
              className={`btn-action ${i === currentSection ? 'add' : ''}`}
              style={{
                flex: '1 0 auto', justifyContent: 'center', fontSize: '0.82rem',
                background: i === currentSection ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                borderColor: i === currentSection ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)',
                color: i === currentSection ? '#93c5fd' : 'var(--text-muted)'
              }}>
              {isDone ? '✓ ' : ''}{labelForIndex(i)}
            </button>
          );
        })}
        {questions.length < 5 && (
          <button onClick={addQuestion}
            className="btn-action add"
            style={{ flex: '0 0 auto', fontSize: '0.82rem', padding: '6px 14px' }}>
            + إضافة سؤال
          </button>
        )}
      </div>

      <div className="eval-table-area">
        <div className="glass-panel" style={{ maxWidth: 700, margin: '0 auto' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: 16 }}>{labelForIndex(currentSection)}</h3>

          <div style={{ marginBottom: 20, padding: '16px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: 10, fontSize: '0.85rem' }}>
              الصوت والأداء — من {VOICE_MAX}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="number" min="0" max="10" step="0.5" value={section.voiceScore}
                onChange={e => updateVoice(currentSection, e.target.value)}
                style={{
                  width: 80, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)',
                  color: 'var(--text-main)', padding: '10px 12px', borderRadius: 12, textAlign: 'center',
                  fontSize: '1.3rem', fontWeight: 700, direction: 'ltr'
                }}
                autoFocus
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>/ {VOICE_MAX}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {DEDUCTION_KEYS.map(key => {
              const count = section.deductions[key] || 0;
              const val = DEDUCTION_VALUES[key] || 0;
              return (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '8px 12px',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}>
                  <button onClick={() => dec(currentSection, key)}
                    className="btn-action edit-btn"
                    style={{ padding: '4px 8px', opacity: count === 0 ? 0.3 : 1, fontSize: '0.9rem' }}
                    disabled={count === 0}>−</button>
                  <span style={{ flex: 1, fontSize: '0.82rem' }}>{key}</span>
                  <span style={{ fontWeight: 700, fontSize: '1rem', minWidth: 24, textAlign: 'center' }}>{ar(count)}</span>
                  <button onClick={() => inc(currentSection, key)}
                    className="btn-action edit-btn"
                    style={{ padding: '4px 8px', fontSize: '0.9rem' }}>+</button>
                  <span style={{ color: '#fca5a5', fontSize: '0.75rem', minWidth: 36, textAlign: 'left' }}>
                    -{val.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{
            marginTop: 20, padding: '14px 18px', borderRadius: 12,
            background: `${scoreColor}12`, border: `1px solid ${scoreColor}30`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ color: 'var(--text-muted)' }}>مجموع السؤال</span>
            <strong style={{ fontSize: '1.2rem', color: scoreColor }}>
              {ar(questionScore(section.voiceScore, section.deductions))}/{VOICE_MAX}
            </strong>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'space-between' }}>
            <div>
              {currentSection < questions.length - 1 ? (
                <button className="btn-primary" onClick={() => setCurrentSection(s => s + 1)}
                  style={{ width: 'auto', padding: '10px 40px' }}>
                  التالي ←
                </button>
              ) : (
                <button className="btn-primary" onClick={handleSubmit} disabled={saving || totalScore === 0}
                  style={{ width: 'auto', padding: '12px 48px', background: '#166534' }}>
                  {saving ? 'جارٍ الحفظ...' : 'تسليم التقييم'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="eval-footer">
        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          {questions.map((q, i) => {
            const s = questionScore(q.voiceScore, q.deductions);
            return `${labelForIndex(i)}: ${ar(s)}/${VOICE_MAX}${i < questions.length - 1 ? ' | ' : ''}`;
          })}
        </span>
        <div className="eval-score-badge" style={{ background: `${scoreColor}1A`, borderColor: `${scoreColor}40`, color: scoreColor, padding: '6px 16px', fontSize: '0.9rem' }}>
          النتيجة النهائية: {ar(totalScore)}%
        </div>
      </div>
    </div>
  );
}
