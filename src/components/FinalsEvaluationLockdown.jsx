import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { ar } from '../utils/numbers.js';
import { DEDUCTION_KEYS, QUAL_DEDUCTIONS, totalDeductionAmount, VOICE_MAX } from '../utils/qualificationConfig.js';
import Modal from './Modal.jsx';

const MAX_PER_QUESTION = 20;
const STORAGE_KEY = 'waqf_eval_state';
const META_KEY = 'waqf_eval_meta';

function emptyDeductions() {
  return Object.fromEntries(DEDUCTION_KEYS.map(k => [k, 0]));
}

function initQuestions() {
  return [
    { index: 0, voiceScore: 0, deductions: emptyDeductions() },
    { index: 1, voiceScore: 0, deductions: emptyDeductions() },
    { index: 2, voiceScore: 0, deductions: emptyDeductions() }
  ];
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
  const [questions, setQuestions] = useState(initQuestions);
  const [currentSection, setCurrentSection] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const historyRef = useRef([]);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}_${queueItem.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length >= 3) {
          setQuestions(parsed);
        }
      }
    } catch (_) {}
    hydrated.current = true;
  }, [queueItem.id]);

  useEffect(() => {
    if (hydrated.current) {
      localStorage.setItem(`${STORAGE_KEY}_${queueItem.id}`, JSON.stringify(questions));
      localStorage.setItem(`${META_KEY}_${queueItem.id}`, JSON.stringify({
        studentName: queueItem.student?.name || '',
        level: queueItem.student?.level || '',
        matn: queueItem.student?.matn || '',
        committeeMemberCount: queueItem.committee_member_count || 2
      }));
    }
  }, [questions, queueItem.id, queueItem.student]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    document.body.style.overflow = 'hidden';
    const handlePopState = (e) => { e.preventDefault(); window.history.pushState(null, '', window.location.href); };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') e.preventDefault();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.body.style.overflow = '';
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const persist = useCallback((qs) => {
    localStorage.setItem(`${STORAGE_KEY}_${queueItem.id}`, JSON.stringify(qs));
  }, [queueItem.id]);

  const addQuestion = () => {
    setQuestions(prev => {
      const next = [...prev, { index: prev.length, voiceScore: 0, deductions: emptyDeductions() }];
      persist(next);
      return next;
    });
  };

  const updateVoice = (idx, val) => {
    const n = Number(val);
    if (val !== '' && (n < 5 || n > 9)) return;
    setQuestions(prev => {
      const next = prev.map((q, i) => i === idx ? { ...q, voiceScore: val === '' ? '' : n } : q);
      persist(next);
      return next;
    });
  };

  const inc = (idx, key) => {
    historyRef.current.push({ questionIdx: idx, key });
    setQuestions(prev => {
      const next = prev.map((q, i) => i === idx ? { ...q, deductions: { ...q.deductions, [key]: (q.deductions[key] || 0) + 1 } } : q);
      persist(next);
      return next;
    });
  };

  const handleUndo = () => {
    if (historyRef.current.length === 0) return;
    const last = historyRef.current.pop();
    setQuestions(prev => {
      const next = prev.map((q, i) => i === last.questionIdx ? { ...q, deductions: { ...q.deductions, [last.key]: Math.max(0, (q.deductions[last.key] || 0) - 1) } } : q);
      persist(next);
      return next;
    });
  };

  const totalScore = useMemo(() => totalPercentage(questions), [questions]);
  const section = questions[currentSection];

  const allVoicesValid = useMemo(() => questions.every(q => {
    if (q.voiceScore === '' || q.voiceScore === 0) return false;
    const n = Number(q.voiceScore);
    return n >= 5 && n <= 9;
  }), [questions]);

  const doSubmit = async () => {
    setShowConfirm(false);
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

    localStorage.removeItem(`${STORAGE_KEY}_${queueItem.id}`);
    localStorage.removeItem(`${META_KEY}_${queueItem.id}`);

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{labelForIndex(currentSection)}</h3>
            <button onClick={handleUndo} disabled={historyRef.current.length === 0}
              className="btn-action"
              style={{ padding: '6px 16px', fontSize: '0.82rem', opacity: historyRef.current.length === 0 ? 0.3 : 1 }}>
              تراجع
            </button>
          </div>

          <div style={{ marginBottom: 20, padding: '16px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: 10, fontSize: '0.85rem' }}>
              الصوت والأداء — من {VOICE_MAX} (يُسمح {VOICE_MAX === 'عشرة' ? '5 إلى 9' : '5-9'})
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input type="number" min="5" max="9" step="0.5"
                value={section.voiceScore === 0 ? '' : section.voiceScore}
                onChange={e => updateVoice(currentSection, e.target.value)}
                placeholder="5-9"
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {DEDUCTION_KEYS.map(key => {
              const count = section.deductions[key] || 0;
              const val = QUAL_DEDUCTIONS[key] || 0;
              const hasCount = count > 0;
              return (
                <div key={key} onClick={() => inc(currentSection, key)}
                  role="button" tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inc(currentSection, key); } }}
                  style={{
                    cursor: 'pointer', userSelect: 'none',
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: hasCount ? 'rgba(252,165,165,0.08)' : 'rgba(255,255,255,0.03)',
                    borderRadius: 14, padding: '12px 14px',
                    border: hasCount ? '1px solid rgba(252,165,165,0.25)' : '1px solid rgba(255,255,255,0.06)',
                    transition: 'background 0.1s, border-color 0.1s'
                  }}>
                  <span style={{
                    flex: 1, fontSize: '0.85rem', fontWeight: hasCount ? 600 : 400,
                    color: hasCount ? '#fca5a5' : 'var(--text-main)'
                  }}>{key}</span>
                  <span style={{
                    fontWeight: 700, fontSize: '1.1rem', minWidth: 30, textAlign: 'center',
                    color: hasCount ? '#fca5a5' : 'var(--text-muted)'
                  }}>{ar(count)}</span>
                  <span style={{
                    color: '#fca5a5', fontSize: '0.75rem', minWidth: 40, textAlign: 'left',
                    fontWeight: 500
                  }}>-{val.toFixed(1)}</span>
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
                <button className="btn-primary" onClick={() => setShowConfirm(true)}
                  disabled={saving || !allVoicesValid}
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

      {showConfirm && (
        <Modal title="" onClose={() => setShowConfirm(false)}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontSize: '1.15rem', marginBottom: 12 }}>هل أنت متأكد من تسليم التقييم؟</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>
              {queueItem.student?.name} — النتيجة النهائية: {ar(totalScore)}%
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn-primary" onClick={doSubmit} style={{ width: 'auto', padding: '10px 36px', background: '#166534' }}>
                نعم، تسليم
              </button>
              <button className="btn-action" onClick={() => setShowConfirm(false)} style={{ padding: '10px 36px' }}>
                  لا
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
