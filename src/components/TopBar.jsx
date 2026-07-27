import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useConnection } from '../hooks/useConnection.js';
import { ar } from '../utils/numbers.js';
import { ChartIcon, LogoutIcon, OfflineIcon, ShieldIcon, TeacherIcon } from './Icons.jsx';

export default function TopBar() {
  const { user, logout, isAdmin } = useAuth();
  const { online, pending, syncNow } = useConnection();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="topbar">
      <div className="who">
        <div className="avatar">{isAdmin ? <ShieldIcon /> : <TeacherIcon />}</div>
        <div>
          <div className="name">{user.name}</div>
          <div className="role">
            {isAdmin ? 'مدير النظام' : `محفّظ — الحلقة ${user.halaqa_number ?? ''}`}
          </div>
        </div>
      </div>

      <div className="controls-group">
        {!online && (
          <span className="conn-badge offline" title="لا يوجد اتصال — التعديلات تُحفظ محلياً">
            <OfflineIcon />
            بلا اتصال
          </span>
        )}

        {pending > 0 && (
          <button
            className="conn-badge pending"
            onClick={syncNow}
            title="عمليات محفوظة محلياً — انقر للمزامنة الآن"
          >
            {ar(pending)} بانتظار المزامنة
          </button>
        )}

        <button className="btn-action" onClick={() => navigate('/dashboard')}>
          <ChartIcon style={{ width: 16, height: 16 }} />
          الإحصائيات
        </button>
        <button className="btn-action" onClick={() => navigate('/gateway')}>
          البوابة
        </button>
        <button className="btn-action logout" onClick={handleLogout}>
          <LogoutIcon />
          خروج
        </button>
      </div>
    </div>
  );
}
