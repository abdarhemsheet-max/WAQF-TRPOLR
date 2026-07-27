import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useConnection } from '../hooks/useConnection.js';
import { ar } from '../utils/numbers.js';
import { ChartIcon, LogoutIcon, OfflineIcon } from './Icons.jsx';

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
      <div className="topbar-right">
        <div className="dept-name">دورة حفاظ الوحيين السادسة</div>
        <div className="dept-sub">مكتب أوقاف طرابلس المركز · قسم شؤون القرآن الكريم والسنة النبوية</div>
      </div>

      <div className="topbar-center">
        <div className="name">{isAdmin ? 'مدير النظام' : user.name}</div>
        <div className="role">
          {isAdmin ? '' : `محفّظ — الحلقة ${user.halaqa_number ?? ''}`}
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

        {isAdmin && (
          <button className="btn-action" onClick={() => navigate('/dashboard')}>
            <ChartIcon style={{ width: 16, height: 16 }} />
            الإحصائيات
          </button>
        )}
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
