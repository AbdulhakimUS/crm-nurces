import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth';
import i18n from '../i18n';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }

    authApi.me()
      .then(({ data }) => {
        setUser(data);
        if (data.language) i18n.changeLanguage(data.language);
        if (data.theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
      })
      .catch(() => {
        localStorage.removeItem('token');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (loginVal, password) => {
    const { data } = await authApi.login(loginVal, password);
    if (data.token) localStorage.setItem('token', data.token);
    setUser(data);
    if (data.language) i18n.changeLanguage(data.language);
    if (data.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
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
      localStorage.removeItem('token');
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
