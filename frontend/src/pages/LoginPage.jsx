// src/pages/LoginPage.jsx — страница входа для клиентов
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { Input, Button, Spinner } from '../components/UI';
import { ROUTES } from '../constants/routes';

export default function LoginPage() {
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
      if (user.role === 'admin') {
        navigate(ROUTES.ADMIN_DASHBOARD);
      } else {
        navigate(ROUTES.DASHBOARD);
      }
    } catch (err) {
      const msg = err.response?.data?.message || t('auth.invalidCredentials');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-medical-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Логотип */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-500 text-white text-3xl mb-4 shadow-lg">
            💉
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">VaccinePro</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('auth.clientPanel')}</p>
        </div>

        {/* Форма */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label={t('auth.loginPlaceholder')}
              placeholder={t('auth.loginPlaceholder')}
              value={form.login}
              onChange={(e) => setForm(p => ({ ...p, login: e.target.value }))}
              required
              autoFocus
            />
            <Input
              label={t('auth.passwordPlaceholder')}
              type="password"
              placeholder={t('auth.passwordPlaceholder')}
              value={form.password}
              onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
              required
            />

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <Button type="submit" loading={loading} size="lg" className="mt-2 w-full">
              {t('auth.loginBtn')}
            </Button>
          </form>
        </div>

        {/* Ссылка на admin */}
        <div className="text-center mt-4">
          <a href="/admin" className="text-xs text-gray-400 hover:text-primary-500 transition-colors">
            {t('auth.adminPanel')} →
          </a>
        </div>
      </div>
    </div>
  );
}