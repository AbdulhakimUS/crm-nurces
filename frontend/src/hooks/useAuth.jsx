import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyTheme = (theme) => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then(({ data }) => {
        setUser(data);
        applyTheme(data.theme);
      })
      .catch(() => { localStorage.removeItem('token'); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = async (loginVal, password) => {
    const { data } = await authApi.login(loginVal, password);
    if (data.token) localStorage.setItem('token', data.token);
    setUser(data);
    applyTheme(data.theme);
    return data;
  };

  const logout = async () => {
    try { await authApi.logout(); } catch {}
    localStorage.removeItem('token');
    setUser(null);
    document.documentElement.classList.remove('dark');
  };

  const updateUser = (updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates };
      if (updates.theme) applyTheme(updates.theme);
      return updated;
    });
  };

  const fetchMe = async () => {
    try { const { data } = await authApi.me(); setUser(data); applyTheme(data.theme); }
    catch { localStorage.removeItem('token'); setUser(null); }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, fetchMe, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
