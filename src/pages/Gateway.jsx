import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import TopBar from '../components/TopBar.jsx';
import { BookIcon, StarIcon, ChartIcon } from '../components/Icons.jsx';

/** بوابة النظام — المدخل الوحيد إلى لوحة التحكم */
export default function Gateway() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="container">
      <TopBar />

      <div className="content-card">
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
          <h2>دورة حفاظ الوحيين السادسة</h2>
          <p>متابعة إنجاز الطلاب في المتون المقررة</p>
        </div>

        <div
          className="gateway-card"
          onClick={() => navigate('/qualifications')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') navigate('/qualifications');
          }}
        >
          <div className="icon-circle">
            <StarIcon />
          </div>
          <h2>تصفية دورة حفاظ الوحيين</h2>
          <p>لجان التحكيم وتقييم الطلاب</p>
        </div>

        <div
          className="gateway-card"
          onClick={() => navigate('/leaderboard')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') navigate('/leaderboard');
          }}
        >
          <div className="icon-circle">
            <ChartIcon />
          </div>
          <h2>لوحة الشرف والنتائج النهائية</h2>
          <p>عرض نتائج التصفية مرتبة حسب المستوى</p>
        </div>
      </div>
      </div>
    </div>
  );
}
