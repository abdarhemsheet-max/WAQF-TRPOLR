import { useAuth } from '../context/AuthContext.jsx';
import TopBar from '../components/TopBar.jsx';

export default function Qualifications() {
  const { user } = useAuth();

  return (
    <div className="container">
      <TopBar />

      <div className="title">
        <h1>تصفيات دورة حفاظ الوحيين</h1>
        <p>مرحباً بك، {user.name}</p>
      </div>

      <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🏆</div>
        <h2 style={{ marginBottom: 8 }}>قريباً</h2>
        <p style={{ color: 'var(--text-muted)' }}>سيتم تفعيل نظام التصفيات قريباً</p>
      </div>
    </div>
  );
}
