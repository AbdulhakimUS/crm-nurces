// src/pages/AdminLoginPage.jsx — страница входа для администратора
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { Input, Button } from '../components/UI';
import { ROUTES } from '../constants/routes';

export default function AdminLoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ login: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(form.login, form.password);
      if (user.role !== 'admin') {
        setError('Этот аккаунт не является администраторским');
        return;
      }
      navigate(ROUTES.ADMIN_DASHBOARD);
    } catch (err) {
      setError(err.response?.data?.message || t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Логотип */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-700 text-white text-3xl mb-4 border border-gray-600">
            🔐
          </div>
          <h1 className="text-xl font-semibold text-white">VaccinePro</h1>
          <p className="text-sm text-gray-400 mt-1">{t('auth.adminPanel')}</p>
        </div>

        {/* Форма */}
        <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-700">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">{t('auth.loginPlaceholder')}</label>
              <input
                className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-700 text-white border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 placeholder-gray-400"
                placeholder={t('auth.loginPlaceholder')}
                value={form.login}
                onChange={(e) => setForm(p => ({ ...p, login: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-300">{t('auth.passwordPlaceholder')}</label>
              <input
                type="password"
                className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-700 text-white border-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 placeholder-gray-400"
                placeholder={t('auth.passwordPlaceholder')}
                value={form.password}
                onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
                required
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 bg-gray-600 hover:bg-gray-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {t('auth.loginBtn')}
            </button>
          </form>
        </div>

        <div className="text-center mt-4">
          <a href="/" className="text-xs text-gray-500 hover:text-gray-400 transition-colors">
            ← {t('auth.clientPanel')}
          </a>
        </div>
      </div>
    </div>
  );
}