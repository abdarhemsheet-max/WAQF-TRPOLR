import { useState } from 'react';
import { DEMO_ACCOUNTS, resetDemoDb } from '../lib/demoData.js';

/** شريط الوضع التجريبي — يظهر فقط حين لا يوجد اتصال بـ Supabase */
export default function DemoBanner() {
  const [open, setOpen] = useState(false);

  const handleReset = () => {
    if (!window.confirm('سيتم حذف كل ما أضفته وإرجاع البيانات التجريبية لحالتها الأصلية. هل تريد المتابعة؟')) {
      return;
    }
    resetDemoDb();
    localStorage.removeItem('waqf.session');
    window.location.href = '/login';
  };

  return (
    <div className="demo-banner">
      <div className="demo-banner-row">
        <span className="demo-chip">وضع تجريبي</span>
        <span className="demo-text">
          بيانات وهمية محفوظة في متصفحك — بلا Supabase. كل الإضافات والتعديلات تعمل فعلياً.
        </span>
        <div className="demo-actions">
          <button className="btn-action" onClick={() => setOpen((v) => !v)}>
            {open ? 'إخفاء الحسابات' : 'حسابات الدخول'}
          </button>
          <button className="btn-action" onClick={handleReset}>
            إعادة التعيين
          </button>
        </div>
      </div>

      {open && (
        <div className="demo-accounts">
          {DEMO_ACCOUNTS.map((a) => (
            <div className="demo-account" key={a.passcode}>
              <span className="level-badge">{a.role}</span>
              <span className="demo-account-name">{a.name}</span>
              <code>{a.passcode}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
