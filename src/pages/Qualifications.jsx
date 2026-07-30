import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';
import { ar } from '../utils/numbers.js';
import TopBar from '../components/TopBar.jsx';
import CommitteeManagement from '../components/CommitteeManagement.jsx';
import CommitteeQueue from '../components/CommitteeQueue.jsx';
import FinalsEvaluationLockdown from '../components/FinalsEvaluationLockdown.jsx';
import AdminFinalsOverview from '../components/AdminFinalsOverview.jsx';

export default function Qualifications() {
  const { user, isAdmin } = useAuth();
  const [committees, setCommittees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scoringItem, setScoringItem] = useState(null);

  const loadCommittees = useCallback(async () => {
    setLoading(true);
    const [comRes, memRes] = await Promise.all([
      supabase.from('committees').select('*').order('created_at'),
      supabase.from('committee_members').select('*')
    ]);

    if (comRes.data && memRes.data) {
      const userCommittees = isAdmin
        ? comRes.data
        : comRes.data.filter(c =>
            memRes.data.some(m => m.committee_id === c.id && m.user_id === user.id)
          );

      const enriched = userCommittees.map(c => ({
        ...c,
        members: memRes.data.filter(m => m.committee_id === c.id)
      }));

      if (!isAdmin) {
        const uRes = await supabase.from('users').select('id, name, halaqa_number');
        if (uRes.data) {
          enriched.forEach(c => {
            c.members = c.members.map(m => {
              const u = uRes.data.find(t => t.id === m.user_id);
              return { ...m, teacher_name: u?.name || '' };
            });
          });
        }
      }

      setCommittees(enriched);
    }
    setLoading(false);
  }, [user.id, isAdmin]);

  useEffect(() => { loadCommittees(); }, [loadCommittees]);

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
