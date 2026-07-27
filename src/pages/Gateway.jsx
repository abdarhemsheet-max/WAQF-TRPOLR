import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import TopBar from '../components/TopBar.jsx';
import { BookIcon, ChartIcon } from '../components/Icons.jsx';

/** بوابة النظام — المدخل الوحيد إلى لوحة التحكم */
export default function Gateway() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="container">
      <TopBar />

      <div className="title">
        <h1>أهلاً بك، {user.name}</h1>
        <p>اختر البرنامج الذي تريد متابعته</p>
      </div>

      <div className="gateway-grid">
        <div
          className="gateway-card"
          onClick={() => navigate(isAdmin ? '/admin' : '/teacher')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') navigate(isAdmin ? '/admin' : '/teacher');
          }}
        >
          <div className="icon-circle">
            <BookIcon />
          </div>
          <h2>مسابقة دورة الوحيين (السابعة)</h2>
          <p>متابعة إنجاز الطلاب في المتون المقررة</p>
        </div>

        <div
          className="gateway-card"
          onClick={() => navigate('/dashboard')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') navigate('/dashboard');
          }}
        >
          <div className="icon-circle">
            <ChartIcon />
          </div>
          <h2>لوحة التحكم الإحصائية</h2>
          <p>أفضل عشرة طلاب وسجل عمليات المراسلة</p>
        </div>
      </div>
    </div>
  );
}
