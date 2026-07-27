import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ShieldIcon, TeacherIcon } from '../components/Icons.jsx';

export default function Login() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState('teacher');
  const [name, setName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/gateway" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const result = await login({ role, name, passcode });
    setBusy(false);

    if (result.error) setError(result.error);
    else navigate('/gateway', { replace: true });
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>دورة تجهيزية لحفاظ الوحيين (السادسة)</h1>
        <p className="subtitle">سجّل الدخول للمتابعة</p>

        <form onSubmit={handleSubmit}>
          {error && <div className="alert error">{error}</div>}

          <div className="role-switch">
            <button
              type="button"
              className={`role-option ${role === 'teacher' ? 'active' : ''}`}
              aria-pressed={role === 'teacher'}
              onClick={() => setRole('teacher')}
            >
              <TeacherIcon />
              محفّظ
            </button>
            <button
              type="button"
              className={`role-option ${role === 'admin' ? 'active' : ''}`}
              aria-pressed={role === 'admin'}
              onClick={() => setRole('admin')}
            >
              <ShieldIcon />
              أدمن
            </button>
          </div>

          <div className="field">
            <label>{role === 'admin' ? 'اسم المستخدم' : 'اسم المحفّظ'}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اكتب الاسم كما هو مسجّل"
              autoComplete="off"
            />
          </div>

          <div className="field">
            <label>رمز الدخول</label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="••••••"
              autoComplete="off"
            />
          </div>

          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'جارٍ التحقق...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
