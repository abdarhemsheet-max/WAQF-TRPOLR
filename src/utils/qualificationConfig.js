import { ar } from './numbers.js';

export const QUAL_DEDUCTIONS = {
  التلعثم: 1.5,
  التردد: 3,
  'اللحن الخفي': 1.5,
  التنبيه: 6,
  الفتح: 12,
  اللحن: 6,
  التحلية: 3,
  'التقديم أو التأخير': 3,
  'النقص أو الزيادة': 3,
  'راوي الحديث أو التخريج': 6
};

export const DEDUCTION_KEYS = Object.keys(QUAL_DEDUCTIONS);

export const VOICE_MAX = 'عشرة';

export function computeFinalScore(voiceScore, deductions) {
  let totalDeduction = 0;
  for (const [key, count] of Object.entries(deductions || {})) {
    totalDeduction += (count || 0) * (QUAL_DEDUCTIONS[key] || 0);
  }
  const score = (90 - totalDeduction) + Number(voiceScore || 0);
  return Math.max(0, Math.round(score * 100) / 100);
}

export function totalDeductionAmount(deductions) {
  let total = 0;
  for (const [key, count] of Object.entries(deductions || {})) {
    total += (count || 0) * (QUAL_DEDUCTIONS[key] || 0);
  }
  return Math.round(total * 100) / 100;
}
