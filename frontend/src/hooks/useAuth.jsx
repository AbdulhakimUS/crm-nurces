import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth';
import i18n from '../i18n/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyTheme = (theme) => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  const applyLanguage = (language) => {
    if (language) i18n.changeLanguage(language);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then(({ data }) => {
        setUser(data);
        applyTheme(data.theme);
        applyLanguage(data.language);
      })
      .catch(() => { localStorage.removeItem('token'); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = async (loginVal, password) => {
    const { data } = await authApi.login(loginVal, password);
    if (data.token) localStorage.setItem('token', data.token);
    setUser(data);
    applyTheme(data.theme);
    applyLanguage(data.language);
    return data;
  };

  const logout = async () => {
    try { await authApi.logout(); } catch {}
    localStorage.removeItem('token');
    setUser(null);
    document.documentElement.classList.remove('dark');
    i18n.changeLanguage('uz');
  };

  const updateUser = (updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates };
      if (updates.theme) applyTheme(updates.theme);
      if (updates.language) applyLanguage(updates.language);
      return updated;
    });
  };

  const fetchMe = async () => {
    try { const { data } = await authApi.me(); setUser(data); applyTheme(data.theme); applyLanguage(data.language); }
    catch { localStorage.removeItem('token'); setUser(null); }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, fetchMe, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
