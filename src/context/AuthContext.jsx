import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const STORAGE_KEY = 'waqf.session';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // استعادة الجلسة من التخزين المحلي عند الإقلاع
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setLoading(false);
  }, []);

  /**
   * مصادقة مخصّصة بلا بريد إلكتروني:
   * (نوع المستخدم + الاسم + رمز الدخول) تُمرَّر لدالة login_user في قاعدة البيانات،
   * وهي دالة SECURITY DEFINER حتى لا يُقرأ عمود passcode من العميل إطلاقاً.
   */
  const login = useCallback(async ({ role, name, passcode }) => {
    const cleanName = name.trim();
    const cleanCode = passcode.trim();

    if (!cleanName || !cleanCode) {
      return { error: 'يرجى إدخال الاسم ورمز الدخول.' };
    }

    const { data, error } = await supabase.rpc('login_user', {
      p_role: role,
      p_name: cleanName,
      p_passcode: cleanCode
    });

    if (error) {
      return { error: 'تعذّر الاتصال بقاعدة البيانات: ' + error.message };
    }

    const account = Array.isArray(data) ? data[0] : data;
    if (!account) {
      return { error: 'الاسم أو رمز الدخول غير صحيح، أو أن نوع المستخدم المحدد لا يطابق الحساب.' };
    }

    setUser(account);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
    return { user: account };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      isAdmin: user?.role === 'admin',
      isTeacher: user?.role === 'teacher'
    }),
    [user, loading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth يجب أن تُستخدم داخل AuthProvider');
  return ctx;
}
