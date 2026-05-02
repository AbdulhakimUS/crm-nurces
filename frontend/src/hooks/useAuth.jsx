import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth';
import i18n from '../i18n';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Вызывается ТОЛЬКО один раз при монтировании
  useEffect(() => {
    let cancelled = false;
    authApi.me()
      .then(({ data }) => {
        if (cancelled) return;
        setUser(data);
        if (data.language) i18n.changeLanguage(data.language);
        if (data.theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []); // пустой массив — только один раз!

  const login = async (loginVal, password) => {
    const { data } = await authApi.login(loginVal, password);
    setUser(data);
    if (data.language) i18n.changeLanguage(data.language);
    if (data.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    return data;
  };

  const logout = async () => {
    try { await authApi.logout(); } catch {}
    setUser(null);
    document.documentElement.classList.remove('dark');
  };

  const updateUser = (updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates };
      if (updates.theme === 'dark') document.documentElement.classList.add('dark');
      else if (updates.theme === 'light') document.documentElement.classList.remove('dark');
      if (updates.language) i18n.changeLanguage(updates.language);
      return updated;
    });
  };

  const fetchMe = async () => {
    try {
      const { data } = await authApi.me();
      setUser(data);
    } catch {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, fetchMe, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
