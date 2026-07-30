import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { getLevelConfig, DEDUCTIONS, CRITERIA } from '../utils/evaluationConfig.js';

const COUNTER_COLORS = {
  لحن: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.35)', text: '#fca5a5' },
  تنبيه: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.35)', text: '#fcd34d' },
  تلعثم: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.35)', text: '#93c5fd' },
};

function initialCounts(subjects) {
  const c = {};
  for (const s of subjects) c[s] = { لحن: 0, تنبيه: 0, تلعثم: 0 };
  return c;
}

export default function EvaluationPanel({ student, user, onClose, onSaved }) {
  const config = getLevelConfig(student.level);
  const [counts, setCounts] = useState(() => initialCounts(config.subjects));
  const [voice, setVoice] = useState(student.voice_rating ?? 0);
  const countsRef = useRef(counts);
  const voiceRef = useRef(voice);
  const evalIdRef = useRef(null);
  const voiceTimer = useRef(null);

  useEffect(() => { countsRef.current = counts; }, [counts]);
  useEffect(() => { voiceRef.current = voice; }, [voice]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const deduction = useMemo(() => {
    let d = 0;
    for (const s of Object.values(counts)) {
      d += (s.لحن || 0) * DEDUCTIONS.لحن + (s.تنبيه || 0) * DEDUCTIONS.تنبيه + (s.تلعثم || 0) * DEDUCTIONS.تلعثم;
    }
    return d;
  }, [counts]);

  const score = useMemo(() => Math.max(0, Math.round((100 - deduction) * 100) / 100), [deduction]);

  const save = useCallback(async (data) => {
    if (evalIdRef.current) {
      await supabase.from('evaluations').update(data).eq('id', evalIdRef.current);
    } else {
      const { data: inserted } = await supabase.from('evaluations').insert({
        student_id: student.id, teacher_id: user?.id ?? null,
        level: student.level, ...data, is_approved: true,
      }).select('id').single();
      if (inserted) evalIdRef.current = inserted.id;
    }
    onSaved?.();
  }, [student.id, user?.id, student.level, onSaved]);

  const inc = useCallback((subject, criterion) => {
    const next = { ...countsRef.current };
    next[subject] = { ...next[subject], [criterion]: (next[subject]?.[criterion] || 0) + 1 };
    countsRef.current = next;
    setCounts(next);
    const d = totalDeduction(next);
    const sc = Math.max(0, Math.round((100 - d) * 100) / 100);
    save({ criteria_data: next, voice_rating: Number(voiceRef.current), final_score: sc });
  }, [save]);

  const dec = useCallback((subject, criterion) => {
    const next = { ...countsRef.current };
    if (!next[subject] || (next[subject]?.[criterion] || 0) <= 0) return;
    next[subject] = { ...next[subject], [criterion]: next[subject][criterion] - 1 };
    countsRef.current = next;
    setCounts(next);
    const d = totalDeduction(next);
    const sc = Math.max(0, Math.round((100 - d) * 100) / 100);
    save({ criteria_data: next, voice_rating: Number(voiceRef.current), final_score: sc });
  }, [save]);

  const handleVoice = useCallback((e) => {
    const v = e.target.value;
    setVoice(v);
    clearTimeout(voiceTimer.current);
    voiceTimer.current = setTimeout(() => {
      save({ criteria_data: countsRef.current, voice_rating: Number(v), final_score: score });
    }, 400);
  }, [save, score]);

  const scoreColor = score >= 80 ? '#6ee7b7' : score >= 60 ? '#fcd34d' : '#fca5a5';

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col" style={{ background: 'rgba(8,12,26,0.97)' }}>
      {/* Header */}
      <header className="flex items-center gap-3 px-3 sm:px-6 py-3 shrink-0 border-b border-white/10"
        style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(16px)' }}>
        <button onClick={onClose}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 cursor-pointer border border-white/15 transition-colors hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-300"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-main)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div className="min-w-0">
          <div className="font-bold text-base sm:text-lg" style={{ color: 'var(--text-main)' }}>تحكيم: {student.name}</div>
          <div className="text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>{config.label}</div>
        </div>
        <div className="mr-auto px-4 py-1.5 rounded-full border font-bold text-sm sm:text-base whitespace-nowrap"
          style={{ background: `${scoreColor}1A`, borderColor: `${scoreColor}40`, color: scoreColor }}>
          {score}%
          <span className="mr-1.5 font-normal text-xs opacity-70">(خصم {deduction.toFixed(1)})</span>
        </div>
      </header>

      {/* Info */}
      <div className="flex gap-3 sm:gap-6 px-3 sm:px-6 py-2 shrink-0 flex-wrap text-sm border-b border-white/5"
        style={{ color: 'var(--text-main)', background: 'rgba(255,255,255,0.02)' }}>
        <span><span style={{ color: 'var(--text-muted)' }}>المستوى:</span> {student.level}</span>
        <span><span style={{ color: 'var(--text-muted)' }}>الإنجاز:</span> {Number(student.progress)}%</span>
        <span><span style={{ color: 'var(--text-muted)' }}>المركز:</span> {student.memorization_center || '—'}</span>
      </div>

      {/* Cards grid */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-7xl mx-auto">
          {config.subjects.map(subject => {
            const subCounts = counts[subject] || { لحن: 0, تنبيه: 0, تلعثم: 0 };
            const subTotal = (
              (subCounts.لحن || 0) * DEDUCTIONS.لحن +
              (subCounts.تنبيه || 0) * DEDUCTIONS.تنبيه +
              (subCounts.تلعثم || 0) * DEDUCTIONS.تلعثم
            );
            return (
              <div key={subject}
                className="rounded-2xl border overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}>
                <div className="flex items-center justify-between px-4 py-2.5 border-b"
                  style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.06)' }}>
                  <span className="font-bold text-sm sm:text-base" style={{ color: '#e2e8f0' }}>{subject}</span>
                  {subTotal > 0 && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>
                      -{subTotal.toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="p-3 space-y-3">
                  {CRITERIA.map(criterion => {
                    const val = subCounts[criterion] || 0;
                    const clr = COUNTER_COLORS[criterion];
                    return (
                      <div key={criterion} className="flex items-center gap-2">
                        <button onClick={() => dec(subject, criterion)}
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-lg font-bold shrink-0 cursor-pointer transition-all border disabled:opacity-20 disabled:cursor-not-allowed"
                          style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}
                          disabled={val === 0} aria-label={`إنقاص ${criterion}`} title="إنقاص">−</button>
                        <button onClick={() => inc(subject, criterion)}
                          className="flex-1 flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl cursor-pointer transition-all border text-sm sm:text-base font-semibold min-h-[44px]"
                          style={{
                            background: val > 0 ? clr.bg : 'rgba(255,255,255,0.04)',
                            borderColor: val > 0 ? clr.border : 'rgba(255,255,255,0.1)',
                            color: val > 0 ? clr.text : 'rgba(255,255,255,0.35)',
                          }}
                          aria-label={`${criterion}: ${val}`}>
                          <span>{criterion}</span>
                          <span className="flex items-center gap-1.5">
                            <span className="text-lg sm:text-xl font-bold tabular-nums ltr">{val}</span>
                            {val > 0 && (
                              <span className="text-xs opacity-60">(-{val * DEDUCTIONS[criterion]})</span>
                            )}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between gap-3 px-3 sm:px-6 py-3 shrink-0 border-t border-white/10 flex-wrap"
        style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center gap-2 sm:gap-3">
          <label className="text-xs sm:text-sm whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>تقييم الصوت</label>
          <div className="flex items-center gap-1.5">
            <input type="number" min="0" max="10" step="0.5" value={voice} onChange={handleVoice}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-center text-sm sm:text-base outline-none focus:border-blue-500 ltr"
              style={{ color: 'var(--text-main)', width: 'clamp(56px,8vw,72px)' }} />
            <span className="text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>/عشرة</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs sm:text-sm font-semibold ml-2 px-3 py-1.5 rounded-lg"
            style={{ background: `${scoreColor}1A`, color: scoreColor }}>
            الخصم الكلي: <span className="tabular-nums">{deduction.toFixed(1)}</span>
          </div>
          <button onClick={onClose}
            className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-semibold cursor-pointer border text-sm sm:text-base whitespace-nowrap transition-colors hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-300"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-main)', borderColor: 'rgba(255,255,255,0.12)' }}>
            إغلاق
          </button>
        </div>
      </footer>
    </div>
  );
}

function totalDeduction(counts) {
  let d = 0;
  for (const s of Object.values(counts)) {
    d += (s.لحن || 0) * DEDUCTIONS.لحن + (s.تنبيه || 0) * DEDUCTIONS.تنبيه + (s.تلعثم || 0) * DEDUCTIONS.تلعثم;
  }
  return d;
}
