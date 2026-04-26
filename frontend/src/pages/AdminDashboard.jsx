// src/pages/AdminDashboard.jsx — кабинет администратора
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { adminApi } from '../api/admin';
import { Button, Modal, Input, StatCard, Spinner } from '../components/UI';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState({ clients: 0, patients: 0, progress: 0 });
  const [loading, setLoading] = useState(true);

  // Модалки
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(null); // client object
  const [passModal, setPassModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Формы
  const [addForm, setAddForm] = useState({ login: '', password: '', name: '' });
  const [editForm, setEditForm] = useState({ login: '', password: '', name: '' });
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '' });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const [cRes, sRes] = await Promise.all([adminApi.getClients(), adminApi.getStats()]);
      setClients(cRes.data);
      setStats(sRes.data);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddClient = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.createClient(addForm);
      toast.success(t('common.success'));
      setAddModal(false);
      setAddForm({ login: '', password: '', name: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleEditClient = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name: editForm.name };
      if (editForm.login) payload.login = editForm.login;
      if (editForm.password) payload.password = editForm.password;
      await adminApi.updateClient(editModal.id, payload);
      toast.success(t('common.success'));
      setEditModal(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await adminApi.deleteClient(id);
      toast.success(t('common.success'));
      setDeleteConfirm(null);
      fetchData();
    } catch {
      toast.error(t('common.error'));
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.changePassword(passForm);
      toast.success(t('profile.credentialsUpdated'));
      setPassModal(false);
      setPassForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Шапка */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💉</span>
            <div>
              <h1 className="text-base font-semibold text-gray-900 dark:text-white">VaccinePro</h1>
              <p className="text-xs text-gray-500">{t('auth.adminPanel')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 hidden sm:block">Admin: <strong>{user?.login}</strong></span>
            <Button variant="secondary" size="sm" onClick={() => setPassModal(true)}>
              🔑 {t('admin.changePassword')}
            </Button>
            <Button variant="danger" size="sm" onClick={logout}>
              {t('nav.logout')}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Статистика */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard label={t('admin.totalClients')} value={stats.clients} />
          <StatCard label={t('admin.totalPatients')} value={stats.patients} />
          <StatCard label={t('admin.totalProgress')} value={stats.progress} />
        </div>

        {/* Таблица клиентов */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('admin.clients')}</h2>
            <Button size="sm" onClick={() => setAddModal(true)}>{t('admin.addClient')}</Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{t('admin.login')}</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{t('admin.name')}</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{t('admin.createdAt')}</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {clients.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-gray-900 dark:text-white font-medium">{c.login}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{c.name || '—'}</td>
                    <td className="px-6 py-4 text-gray-500 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => { setEditModal(c); setEditForm({ login: c.login, password: '', name: c.name || '' }); }}
                        >
                          ✏️ {t('patients.edit')}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setDeleteConfirm(c)}
                        >
                          {t('admin.deleteClient')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400">{t('common.noData')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Модалка добавления клиента */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title={t('admin.addClient')}>
        <form onSubmit={handleAddClient} className="flex flex-col gap-4">
          <Input label={t('admin.login')} value={addForm.login} onChange={e => setAddForm(p => ({ ...p, login: e.target.value }))} required />
          <Input label="Пароль" type="password" value={addForm.password} onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))} required />
          <Input label={t('admin.name')} value={addForm.name} onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))} />
          <div className="flex gap-3 justify-end mt-2">
            <Button variant="secondary" onClick={() => setAddModal(false)} type="button">{t('patients.cancel')}</Button>
            <Button loading={saving} type="submit">{t('patients.save')}</Button>
          </div>
        </form>
      </Modal>

      {/* Модалка редактирования */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title={t('admin.editClient')}>
        <form onSubmit={handleEditClient} className="flex flex-col gap-4">
          <Input label={t('admin.login')} value={editForm.login} onChange={e => setEditForm(p => ({ ...p, login: e.target.value }))} />
          <Input label="Новый пароль (оставьте пустым если не меняете)" type="password" value={editForm.password} onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))} />
          <Input label={t('admin.name')} value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
          <div className="flex gap-3 justify-end mt-2">
            <Button variant="secondary" onClick={() => setEditModal(null)} type="button">{t('patients.cancel')}</Button>
            <Button loading={saving} type="submit">{t('patients.save')}</Button>
          </div>
        </form>
      </Modal>

      {/* Модалка смены пароля */}
      <Modal open={passModal} onClose={() => setPassModal(false)} title={t('admin.changePassword')}>
        <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
          <Input label={t('admin.currentPassword')} type="password" value={passForm.currentPassword} onChange={e => setPassForm(p => ({ ...p, currentPassword: e.target.value }))} required />
          <Input label={t('admin.newPassword')} type="password" value={passForm.newPassword} onChange={e => setPassForm(p => ({ ...p, newPassword: e.target.value }))} required />
          <div className="flex gap-3 justify-end mt-2">
            <Button variant="secondary" onClick={() => setPassModal(false)} type="button">{t('patients.cancel')}</Button>
            <Button loading={saving} type="submit">{t('patients.save')}</Button>
          </div>
        </form>
      </Modal>

      {/* Подтверждение удаления */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Удалить клиента?">
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
          {t('admin.confirmDeleteClient')} <strong>{deleteConfirm?.login}</strong>
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>{t('patients.cancel')}</Button>
          <Button variant="danger" onClick={() => handleDelete(deleteConfirm?.id)}>{t('patients.delete')}</Button>
        </div>
      </Modal>
    </div>
  );
}