// src/hooks/useAuth.js — хук авторизации и контекст пользователя
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth';
import i18n from '../i18n';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await authApi.me();
      setUser(data);
      // Применяем язык пользователя
      if (data.language) i18n.changeLanguage(data.language);
      // Применяем тему
      if (data.theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (loginVal, password) => {
    const { data } = await authApi.login(loginVal, password);
    setUser(data);
    if (data.language) i18n.changeLanguage(data.language);
    if (data.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return data;
  };

  const logout = async () => {
    await authApi.logout();
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

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, fetchMe, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}