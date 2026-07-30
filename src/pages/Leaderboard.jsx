import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { ar, ar1 } from '../utils/numbers.js';
import { LEVELS } from '../utils/levels.js';
import { PrintIcon, ExportIcon } from '../components/Icons.jsx';
import * as XLSX from 'xlsx';

const RANK_NAMES = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع'];

function rankText(i) {
  const n = i + 1;
  if (n <= 9) return RANK_NAMES[i];
  if (n === 10) return 'العاشر';
  return ar(n);
}

const MEDAL = ['🥇', '🥈', '🥉'];

export default function Leaderboard({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [qRes, eRes] = await Promise.all([
      supabase.from('committee_queue').select('*').eq('status', 'finalized').order('created_at'),
      supabase.from('qualification_evaluations').select('*'),
    ]);
    if (!qRes.data) { setLoading(false); return; }

    const qItems = qRes.data || [];
    const evalsAll = eRes.data || [];

    const fsIds = [...new Set(qItems.filter(q => q.finals_student_id).map(q => q.finals_student_id))];
    const regIds = [...new Set(qItems.filter(q => q.student_id).map(q => q.student_id))];

    const [fsRes, sRes] = await Promise.all([
      fsIds.length ? supabase.from('finals_students').select('*') : { data: [] },
      regIds.length ? supabase.from('students').select('id, name, level, memorization_center') : { data: [] },
    ]);

    const fm = {}; (fsRes.data || []).forEach(f => { fm[f.id] = f; });
    const rm = {}; (sRes.data || []).forEach(s => { rm[s.id] = s; });

    const result = [];
    qItems.forEach(q => {
      const st = q.finals_student_id ? fm[q.finals_student_id] : rm[q.student_id];
      if (!st) return;
      const evs = evalsAll.filter(e => e.queue_id === q.id);
      if (!evs.length) return;
      const avg = Math.round((evs.reduce((s, e) => s + e.final_score, 0) / evs.length) * 10) / 10;
      result.push({
        name: st.name || '',
        level: st.level || '',
        center: st.memorization_center || '',
        score: avg,
      });
    });

    setEntries(result);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const order = LEVELS.map(l => l.level);
    const map = {};
    entries.forEach(e => {
      if (!map[e.level]) map[e.level] = [];
      map[e.level].push(e);
    });
    Object.keys(map).forEach(l => {
      map[l].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ar'));
    });
    const sorted = {};
    order.forEach(l => { if (map[l]) sorted[l] = map[l]; });
    Object.keys(map).forEach(l => { if (!sorted[l]) sorted[l] = map[l]; });
    return sorted;
  }, [entries]);

  const totalStudents = entries.length;
  const levelCount = Object.keys(grouped).length;

  const handlePrint = () => window.print();

  const handleExport = () => {
    const data = [];
    data.push(['📋 لوحة الشرف — النتائج النهائية']);
    data.push([`إجمالي الطلاب: ${ar(totalStudents)}`]);
    data.push([]);

    Object.entries(grouped).forEach(([level, students]) => {
      data.push([`📚 المستوى: ${level}`]);
      data.push(['الترتيب', 'اسم الطالب', 'المركز', 'النتيجة النهائية']);
      students.forEach((s, i) => {
        data.push([rankText(i), s.name, s.center || '—', `${ar1(s.score)}%`]);
      });
      data.push([]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 22 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, 'لوحة الشرف');
    XLSX.writeFile(wb, 'لوحة_الشرف_نتائج_التصفية.xlsx');
  };

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: 28,
      boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 8px 20px rgba(0,0,0,0.08)',
      padding: 'clamp(20px, 3vw, 36px)',
      color: '#1e293b',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 12, marginBottom: 24,
      }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.2rem, 3.5vw, 1.6rem)', fontWeight: 800, color: '#1e293b', margin: 0 }}>
            🏆 لوحة الشرف والنتائج النهائية
          </h1>
          <p style={{ color: '#64748b', fontSize: 'clamp(0.8rem, 2vw, 0.9rem)', marginTop: 4 }}>
            {ar(totalStudents)} طالباً — {ar(levelCount)} مستويات
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={handlePrint} className="btn-action"
            style={{
              background: '#e2e8f0', color: '#334155', border: '1px solid #cbd5e1',
              borderRadius: 12, padding: '10px 16px', fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.85rem',
            }}>
            <PrintIcon /> طباعة
          </button>
          <button onClick={handleExport} className="btn-action export"
            style={{
              background: '#059669', color: '#fff', border: 'none',
              borderRadius: 12, padding: '10px 16px', fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.85rem',
            }}>
            <ExportIcon /> تصدير Excel
          </button>
          {onClose && (
            <button onClick={onClose}
              style={{
                background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca',
                borderRadius: 12, padding: '10px 16px', fontWeight: 700, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.85rem',
              }}>
              ✕ إغلاق
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{
          padding: '60px 20px', textAlign: 'center', color: '#64748b', fontSize: '1rem',
        }}>
          جارٍ تحميل النتائج...
        </div>
      ) : totalStudents === 0 ? (
        <div style={{
          padding: '60px 20px', textAlign: 'center', color: '#64748b', fontSize: '1rem',
        }}>
          لا توجد نتائج معتمدة بعد
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Object.entries(grouped).map(([level, students]) => (
            <LevelSection key={level} level={level} students={students} />
          ))}
        </div>
      )}
    </div>
  );
}

function LevelSection({ level, students }) {
  return (
    <div style={{
      background: '#ffffff',
      borderRadius: 28,
      boxShadow: '0 20px 60px rgba(0,0,0,0.08), 0 8px 20px rgba(0,0,0,0.06)',
      overflow: 'hidden',
    }}>
        <div style={{
          background: 'linear-gradient(135deg, #4A7C8E, #3D6A7A)',
          padding: 'clamp(14px, 2.5vw, 22px) clamp(18px, 3vw, 28px)',
        }}>
          <h2 style={{
            color: '#ffffff', fontSize: 'clamp(1rem, 3vw, 1.25rem)',
            fontWeight: 700, margin: 0,
          }}>
            📚 المستوى: {level}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 'clamp(0.75rem, 1.8vw, 0.85rem)', marginTop: 4 }}>
            {ar(students.length)} طالباً
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            fontSize: 'clamp(0.8rem, 2vw, 0.9rem)',
          }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={thStyle}>الترتيب</th>
                <th style={thStyle}>اسم الطالب</th>
                <th style={thStyle}>المركز</th>
                <th style={thStyle}>النتيجة النهائية</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => {
                const isTop3 = i < 3;
                const medal = isTop3 ? MEDAL[i] : '';
                const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
                return (
                  <tr key={s.name + i} style={{
                    background: bg,
                    borderBottom: '1px solid #e2e8f0',
                  }}>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 36, height: 36, borderRadius: 10,
                        background: isTop3
                          ? (i === 0 ? 'rgba(255,215,0,0.2)' : i === 1 ? 'rgba(192,192,192,0.2)' : 'rgba(205,127,50,0.2)')
                          : '#f1f5f9',
                        border: `1px solid ${isTop3 ? (i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : '#CD7F32') : '#e2e8f0'}`,
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        color: isTop3 ? (i === 0 ? '#b8860b' : i === 1 ? '#71717a' : '#8b5e3c') : '#64748b',
                      }}>
                        {medal || rankText(i)}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: '#1e293b' }}>{s.name}</td>
                    <td style={{ ...tdStyle, color: '#64748b' }}>{s.center || '—'}</td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-block',
                        background: isTop3
                          ? (i === 0 ? '#fef9e7' : i === 1 ? '#f1f5f9' : '#fef5e7')
                          : s.score >= 80 ? '#f0fdf4' : s.score >= 60 ? '#fefce8' : '#fef2f2',
                        color: isTop3
                          ? (i === 0 ? '#92400e' : i === 1 ? '#71717a' : '#9a6a2e')
                          : s.score >= 80 ? '#166534' : s.score >= 60 ? '#854d0e' : '#991b1b',
                        padding: '6px 16px', borderRadius: 10,
                        fontWeight: 700, fontSize: '0.9rem',
                        border: `1px solid ${
                          isTop3
                            ? (i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : '#CD7F32')
                            : s.score >= 80 ? '#bbf7d0' : s.score >= 60 ? '#fef08a' : '#fecaca'
                        }`,
                      }}>
                        {ar1(s.score)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
    </div>
  );
}

const thStyle = {
  textAlign: 'right',
  padding: 'clamp(10px, 1.5vw, 16px) clamp(14px, 2vw, 20px)',
  color: '#64748b',
  fontWeight: 700,
  fontSize: 'clamp(0.75rem, 1.8vw, 0.85rem)',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  textAlign: 'right',
  padding: 'clamp(10px, 1.5vw, 16px) clamp(14px, 2vw, 20px)',
  verticalAlign: 'middle',
};
