export default function CommitteeDashboardHeader({ committee, user }) {
  if (!committee) return null;

  const head = committee.members?.find(m => m.is_head);
  const members = committee.members?.filter(m => !m.is_head) || [];

  return (
    <div className="glass-panel" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 4 }}>{committee.name}</h2>
          {committee.room && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>📍 {committee.room}</span>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {head && (
            <span className="teacher-badge" style={{
              background: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.35)', color: '#fcd34d'
            }}>
              ⭐ {head.teacher_name || head.name || 'رئيس اللجنة'}
            </span>
          )}
          {members.map(m => (
            <span key={m.id || m.user_id} className="teacher-badge">
              {m.teacher_name || m.name || 'عضو'}
            </span>
          ))}
          <span className="level-badge" style={{
            background: user.id === head?.user_id ? 'rgba(16,185,129,0.12)' : 'rgba(59,130,246,0.12)',
            borderColor: user.id === head?.user_id ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)',
            color: user.id === head?.user_id ? '#6ee7b7' : '#93c5fd'
          }}>
            {user.id === head?.user_id ? 'أنت الرئيس' : 'عضو لجنة'}
          </span>
        </div>
      </div>
    </div>
  );
}
