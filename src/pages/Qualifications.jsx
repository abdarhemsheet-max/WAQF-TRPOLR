import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { ar } from '../utils/numbers.js';
import TopBar from '../components/TopBar.jsx';
import CommitteeManagement from '../components/CommitteeManagement.jsx';
import CommitteeQueue from '../components/CommitteeQueue.jsx';
import FinalsEvaluationLockdown from '../components/FinalsEvaluationLockdown.jsx';
import AdminFinalsOverview from '../components/AdminFinalsOverview.jsx';

const STORAGE_KEY = 'waqf_eval_state';
const META_KEY = 'waqf_eval_meta';

export default function Qualifications() {
  const { user, isAdmin } = useAuth();
  const [committees, setCommittees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scoringItem, setScoringItem] = useState(null);

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
        const members = (memRes.data || []).filter(m => m.committee_id === c.id).map(m => ({
          ...m, teacher_name: usersMap[m.user_id] || ''
        }));
        const queue = qItems.filter(q => q.committee_id === c.id).map(q => {
          const student = q.finals_student_id ? finalsMap[q.finals_student_id] : regMap[q.student_id];
          const evaluations = evals.filter(e => e.queue_id === q.id).map(e => ({
            ...e, evaluator_name: usersMap[e.evaluator_id] || ''
          }));
          return { ...q, student, evaluations };
        });
        return { ...c, members, queue };
      });

      setCommittees(enriched);
    }
    setLoading(false);
  }, [user.id, isAdmin]);

  useEffect(() => { loadCommittees(); }, [loadCommittees]);

  // استعادة جلسة تقييم لم تُرسل بعد (بعد تحديث الصفحة)
  useEffect(() => {
    if (loading || isAdmin) return;
    // ابحث عن أي مفتاح تخزين يحوي جلسة تقييم نشطة
    const allKeys = Object.keys(localStorage);
    const evalKey = allKeys.find(k => k.startsWith(STORAGE_KEY) && k !== STORAGE_KEY);
    const metaKey = evalKey ? evalKey.replace(STORAGE_KEY, META_KEY) : null;
    if (!metaKey) return;

    const metaRaw = localStorage.getItem(metaKey);
    if (!metaRaw) return;

    const meta = JSON.parse(metaRaw);
    const queueId = evalKey.replace(`${STORAGE_KEY}_`, '');
    if (!queueId) return;

    // ابحث عن اللجنة التي تخص المستخدم والطالب في الطابور
    const qRes = committees.flatMap(c =>
      (c.queue || []).filter(q => q.id === queueId).map(q => ({ ...q, committeeId: c.id }))
    );

    // إن لم نجده في الذاكرة، نبني كياناً وهمياً من البيانات المحفوظة
    const item = qRes.length > 0 ? qRes[0] : {
      id: queueId,
      student: { name: meta.studentName, level: meta.level, matn: meta.matn },
      evaluations: [],
      committee_member_count: meta.committeeMemberCount || 2
    };

    setScoringItem(item);
  }, [loading, isAdmin, committees]);

  const userCommittee = committees.find(c =>
    c.members?.some(m => m.user_id === user.id)
  );

  const handleSaved = () => {
    setScoringItem(null);
    loadCommittees();
  };

  return (
    <div className="container">
      <TopBar />

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
                  <CommitteeManagement onChanged={loadCommittees} />
                  <div style={{ marginTop: 24 }}>
                    <AdminFinalsOverview onChanged={loadCommittees} />
                  </div>
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
  );
}
