import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { ar } from '../utils/numbers.js';
import TopBar from '../components/TopBar.jsx';
import CommitteeManagement from '../components/CommitteeManagement.jsx';
import CommitteeQueue from '../components/CommitteeQueue.jsx';
import FinalsEvaluationLockdown from '../components/FinalsEvaluationLockdown.jsx';
import AdminFinalsOverview from '../components/AdminFinalsOverview.jsx';
import FinalsStats from '../components/FinalsStats.jsx';
import Leaderboard from './Leaderboard.jsx';

export default function Qualifications() {
  const { user, isAdmin } = useAuth();
  const [committees, setCommittees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scoringItem, setScoringItem] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const loadCommittees = useCallback(async () => {
    setLoading(true);
    const [comRes, memRes, qRes, eRes] = await Promise.all([
      supabase.from('committees').select('*').order('created_at'),
      supabase.from('committee_members').select('*'),
      supabase.from('committee_queue').select('*').order('created_at'),
      supabase.from('qualification_evaluations').select('*')
    ]);

    if (comRes.data && memRes.data) {
      const userCommittees = isAdmin
        ? comRes.data
        : comRes.data.filter(c =>
            memRes.data.some(m => m.committee_id === c.id && m.user_id === user.id)
          );

      const qItems = qRes.data || [];
      const fsIds = [...new Set(qItems.filter(q => q.finals_student_id).map(q => q.finals_student_id))];
      const regIds = [...new Set(qItems.filter(q => q.student_id).map(q => q.student_id))];

      const [fsRes, sRes, uRes] = await Promise.all([
        fsIds.length ? supabase.from('finals_students').select('*') : { data: [] },
        regIds.length ? supabase.from('students').select('id, name, level, matn') : { data: [] },
        supabase.from('users').select('id, name, halaqa_number')
      ]);

      const finalsMap = {}; (fsRes.data || []).forEach(f => { finalsMap[f.id] = f; });
      const regMap = {}; (sRes.data || []).forEach(s => { regMap[s.id] = s; });
      const usersMap = {}; (uRes.data || []).forEach(u => { usersMap[u.id] = u.name; });

      const evals = eRes.data || [];

      const enriched = userCommittees.map(c => {
        const isSingle = c.is_single_judge;
        const evaluationsRequired = isSingle ? 1 : 2;
        const members = (memRes.data || []).filter(m => m.committee_id === c.id).map(m => ({
          ...m, teacher_name: usersMap[m.user_id] || ''
        }));
        const queue = qItems.filter(q => q.committee_id === c.id).map(q => {
          const student = q.finals_student_id ? finalsMap[q.finals_student_id] : regMap[q.student_id];
          const evaluations = evals.filter(e => e.queue_id === q.id).map(e => ({
            ...e, evaluator_name: usersMap[e.evaluator_id] || ''
          }));
          return { ...q, student, evaluations, evaluations_required: evaluationsRequired };
        });
        return { ...c, is_single_judge: isSingle, members, queue };
      });

      setCommittees(enriched);
    }
    setLoading(false);
  }, [user.id, isAdmin]);

  useEffect(() => { loadCommittees(); }, [loadCommittees]);

  useEffect(() => {
    if (loading || isAdmin) return;
    const allKeys = Object.keys(localStorage);
    const evalKey = allKeys.find(k => k.startsWith('waqf_eval_state_'));
    const metaKey = evalKey ? evalKey.replace('waqf_eval_state', 'waqf_eval_meta') : null;
    if (!metaKey) return;

    const metaRaw = localStorage.getItem(metaKey);
    if (!metaRaw) return;

    const meta = JSON.parse(metaRaw);
    const queueId = evalKey.replace('waqf_eval_state_', '');
    if (!queueId) return;

    const qRes = committees.flatMap(c =>
      (c.queue || []).filter(q => q.id === queueId).map(q => ({ ...q, committeeId: c.id }))
    );

    const item = qRes.length > 0 ? qRes[0] : {
      id: queueId,
      student: { name: meta.studentName, level: meta.level, matn: meta.matn },
      evaluations: [],
      evaluations_required: meta.evaluations_required || 2
    };

    setScoringItem(item);
  }, [loading, isAdmin, committees]);

  const userCommittee = committees.find(c =>
    c.members?.some(m => m.user_id === user.id)
  );
  const isHead = userCommittee?.members?.some(m => m.user_id === user.id && m.is_head);

  const handleSaved = () => {
    setScoringItem(null);
    loadCommittees();
  };

  return (
    <div className="container">
      <TopBar />

      <div className="content-card">
        <div className="title">
          <h1>تصفية دورة حفاظ الوحيين</h1>
          <p style={{ color: 'var(--text-muted)' }}>
            {isAdmin ? 'إدارة لجان التحكيم والتصفيات' : 'مرحباً بك في التصفيات'}
          </p>
        </div>

      {loading ? (
        <div className="empty-state">جارٍ تحميل البيانات...</div>
      ) : (
        <>
          {scoringItem ? (
            <FinalsEvaluationLockdown
              queueItem={scoringItem}
              user={user}
              onSubmitted={handleSaved}
            />
          ) : (
            <>
              {isAdmin && (
                <>
                  <FinalsStats committees={committees} />
                  <CommitteeManagement onChanged={loadCommittees} />
                  <div style={{
                    display: 'flex', gap: 8, marginTop: 20, marginBottom: 12,
                  }}>
                    <button className="btn-action"
                      onClick={() => setShowLeaderboard(true)}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--glass-border)',
                      }}>
                      🏆 لوحة الشرف
                    </button>
                  </div>
                  <AdminFinalsOverview onChanged={loadCommittees} />
                </>
              )}

              {!isAdmin && userCommittee && (
                <CommitteeQueue
                  committee={userCommittee}
                  user={user}
                  onEvaluate={setScoringItem}
                  onChanged={loadCommittees}
                />
              )}

              {!isAdmin && !userCommittee && (
                <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', marginBottom: 16 }}>🏆</div>
                  <h2 style={{ marginBottom: 8 }}>لم يتم تعيينك في لجنة تحكيم</h2>
                  <p style={{ color: 'var(--text-muted)' }}>يتم إعداد التصفيات — سيتم إشعارك عند الانضمام للجنة</p>
                </div>
              )}
            </>
          )}
        </>
      )}
      </div>

      {showLeaderboard && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(2,6,23,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          padding: 'clamp(12px, 2vw, 24px)',
          overflow: 'auto',
        }} onClick={() => setShowLeaderboard(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 1100, margin: 'auto' }}>
            <Leaderboard onClose={() => setShowLeaderboard(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
