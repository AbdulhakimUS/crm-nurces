import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { patientsApi } from '../api/patients';
import { clientApi } from '../api/admin';
import { Button, Card, Input, Textarea, Select, Modal, BackButton, Avatar, Spinner, EmptyState } from '../components/UI';

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function PatientsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    setLoading(true);
    patientsApi.list(debouncedSearch)
      .then(r => setPatients(r.data))
      .catch(() => toast.error(t('common.error')))
      .finally(() => setLoading(false));
  }, [debouncedSearch]);

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <Input placeholder={t('patients.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="mb-4" />
      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : patients.length === 0 ? (
        <EmptyState message={t('patients.noPatients')} icon="🏥" />
      ) : (
        <div className="flex flex-col gap-3">
          {patients.map(p => (
            <Card key={p.id} onClick={() => navigate('patient/' + p.id)}>
              <div className="flex items-center gap-3">
                <Avatar name={p.full_name} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{p.full_name}</p>
                  <p className="text-sm text-gray-500">{p.passport}</p>
                  <p className="text-xs text-gray-400">{p.registration_date}</p>
                </div>
                <span className="text-gray-400">›</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AddPatient() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', passport: '', phone: '', registration_date: new Date().toISOString().split('T')[0], birth_date: '', blood_group: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name || !form.passport || !form.phone) { toast.error(t('patients.required')); return; }
    setSaving(true);
    try {
      await patientsApi.create(form);
      toast.success(t('patients.saved'));
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.error'));
    } finally { setSaving(false); }
  };

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="p-4 max-w-lg mx-auto">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label={t('patients.fullName')} value={form.full_name} onChange={set('full_name')} required />
        <Input label={t('patients.passport')} value={form.passport} onChange={set('passport')} required />
        <Input label={t('patients.phone')} value={form.phone} onChange={set('phone')} required />
        <Input label={t('patients.registrationDate')} type="date" value={form.registration_date} onChange={set('registration_date')} required />
        <Input label={t('patients.birthDate')} type="date" value={form.birth_date} onChange={set('birth_date')} />
        <Input label={t('patients.bloodGroup')} value={form.blood_group} onChange={set('blood_group')} placeholder="A+, B-, O+..." />
        <Button type="submit" loading={saving} size="lg" className="w-full mt-2">{t('patients.save')}</Button>
      </form>
    </div>
  );
}

function PatientPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [progress, setProgress] = useState([]);
  const [filteredProgress, setFilteredProgress] = useState([]);
  const [tab, setTab] = useState('data');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [addFieldModal, setAddFieldModal] = useState(false);
  const [newField, setNewField] = useState({ label: '', value: '' });
  const [addProgressModal, setAddProgressModal] = useState(false);
  const [progressForm, setProgressForm] = useState({ title: '', vaccine_type: '', custom_vaccine: '', description: '', record_date: new Date().toISOString().split('T')[0] });
  const [progressPhoto, setProgressPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);

  const fetchPatient = useCallback(async () => {
    try {
      const [pRes, prRes] = await Promise.all([patientsApi.get(id), patientsApi.getProgress(id)]);
      setPatient(pRes.data); setForm(pRes.data); setProgress(prRes.data); setFilteredProgress(prRes.data);
    } catch { toast.error(t('common.error')); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchPatient(); }, [fetchPatient]);

  useEffect(() => {
    if (!dateFilter) { setFilteredProgress(progress); return; }
    setFilteredProgress(progress.filter(r => r.record_date === dateFilter));
  }, [dateFilter, progress]);

  const handleSave = async () => {
    setSaving(true);
    try { await patientsApi.update(id, form); toast.success(t('patients.saved')); setEditing(false); fetchPatient(); }
    catch { toast.error(t('common.error')); } finally { setSaving(false); }
  };

  const handleAddField = async () => {
    if (!newField.label) return;
    const extra = [...(patient.extra_fields || []), newField];
    await patientsApi.update(id, { extra_fields: extra });
    setAddFieldModal(false); setNewField({ label: '', value: '' }); fetchPatient();
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProgressPhoto(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const getVaccineType = () => {
    if (progressForm.vaccine_type === 'Boshqa') return progressForm.custom_vaccine;
    return progressForm.vaccine_type;
  };

  const handleAddProgress = async () => {
    const vaccineType = getVaccineType();
    if (!progressForm.title || !vaccineType || !progressForm.description) { toast.error(t('patients.required')); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('title', progressForm.title);
      fd.append('vaccine_type', vaccineType);
      fd.append('description', progressForm.description);
      fd.append('record_date', progressForm.record_date);
      if (progressPhoto) fd.append('photo', progressPhoto);
      await patientsApi.addProgress(id, fd);
      toast.success(t('progress.addSuccess'));
      setAddProgressModal(false);
      setProgressForm({ title: '', vaccine_type: '', custom_vaccine: '', description: '', record_date: new Date().toISOString().split('T')[0] });
      setProgressPhoto(null); setPhotoPreview(null); fetchPatient();
    } catch { toast.error(t('common.error')); } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await patientsApi.delete(id); toast.success(t('common.success')); navigate('/dashboard'); }
    catch { toast.error(t('common.error')); }
  };

  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  if (!patient) return <EmptyState message={t('common.noData')} />;
  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <BackButton />
      <div className="flex items-center gap-3 mb-6">
        <Avatar name={patient.full_name} size="lg" />
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{patient.full_name}</h2>
          <p className="text-sm text-gray-500">{patient.passport}</p>
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('data')} className={"flex-1 py-2 rounded-lg text-sm font-medium transition-colors " + (tab === 'data' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300')}>{t('patients.data')}</button>
        <button onClick={() => setTab('progress')} className={"flex-1 py-2 rounded-lg text-sm font-medium transition-colors " + (tab === 'progress' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300')}>{t('patients.progress')}</button>
      </div>

      {tab === 'data' && (
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium text-gray-900 dark:text-white">{t('patients.data')}</h3>
              {!editing ? <Button size="sm" onClick={() => setEditing(true)}>{t('patients.edit')}</Button> : (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>{t('patients.cancel')}</Button>
                  <Button size="sm" loading={saving} onClick={handleSave}>{t('patients.save')}</Button>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <Input label={t('patients.fullName')} value={form.full_name || ''} onChange={set('full_name')} disabled={!editing} />
              <Input label={t('patients.passport')} value={form.passport || ''} onChange={set('passport')} disabled={!editing} />
              <Input label={t('patients.phone')} value={form.phone || ''} onChange={set('phone')} disabled={!editing} />
              <Input label={t('patients.registrationDate')} type="date" value={form.registration_date || ''} onChange={set('registration_date')} disabled={!editing} />
              <Input label={t('patients.birthDate')} type="date" value={form.birth_date || ''} onChange={set('birth_date')} disabled={!editing} />
              <Input label={t('patients.bloodGroup')} value={form.blood_group || ''} onChange={set('blood_group')} disabled={!editing} />
            </div>
          </Card>
          <Card>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-gray-900 dark:text-white">{t('patients.extraFields')}</h3>
              <Button size="sm" variant="secondary" onClick={() => setAddFieldModal(true)}>{t('patients.addField')}</Button>
            </div>
            {(patient.extra_fields || []).length === 0 ? <p className="text-sm text-gray-400">{t('common.noData')}</p> : (
              <div className="flex flex-col gap-2">
                {patient.extra_fields.map((f, i) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-gray-500">{f.label}</span>
                    <span className="text-gray-900 dark:text-white font-medium">{f.value}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Button variant="danger" onClick={() => setDeleteConfirm(true)}>{t('patients.delete')}</Button>
        </div>
      )}

      {tab === 'progress' && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input label="Sana bo'yicha filter" type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
            </div>
            {dateFilter && <Button size="sm" variant="secondary" onClick={() => setDateFilter('')}>✕ Tozalash</Button>}
            <Button onClick={() => setAddProgressModal(true)}>{t('progress.addRecord')}</Button>
          </div>

          {filteredProgress.length === 0 ? <EmptyState message={t('progress.noRecords')} icon="💉" /> : (
            filteredProgress.map(r => (
              <Card key={r.id} onClick={() => setSelectedRecord(r)} className="cursor-pointer hover:border-blue-400 transition-all">
                <div className="flex gap-3 items-start">
                  {r.photo_path && (
                    <img src={"/" + r.photo_path} alt={r.title} className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">{r.title}</h4>
                      <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{r.record_date}</span>
                    </div>
                    <span className="inline-block text-xs bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded mb-1">{r.vaccine_type}</span>
                    <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{r.description}</p>
                  </div>
                  <span className="text-gray-400 flex-shrink-0">›</span>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      <Modal open={addFieldModal} onClose={() => setAddFieldModal(false)} title={t('patients.addField')}>
        <div className="flex flex-col gap-4">
          <Input label={t('patients.fieldLabel')} value={newField.label} onChange={e => setNewField(p => ({ ...p, label: e.target.value }))} required />
          <Input label={t('patients.fieldValue')} value={newField.value} onChange={e => setNewField(p => ({ ...p, value: e.target.value }))} />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setAddFieldModal(false)}>{t('patients.cancel')}</Button>
            <Button onClick={handleAddField}>{t('patients.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={addProgressModal} onClose={() => { setAddProgressModal(false); setPhotoPreview(null); }} title={t('progress.addRecord')}>
        <div className="flex flex-col gap-4">
          <Input label={t('progress.recordTitle')} value={progressForm.title} onChange={e => setProgressForm(p => ({ ...p, title: e.target.value }))} required />
          <Select label={t('progress.vaccineType')} value={progressForm.vaccine_type} onChange={e => setProgressForm(p => ({ ...p, vaccine_type: e.target.value }))} required>
            <option value="">— tanlang —</option>
            <option value="COVID-19">COVID-19</option>
            <option value="Gripp">Gripp</option>
            <option value="Gepatit B">Gepatit B</option>
            <option value="Gepatit A">Gepatit A</option>
            <option value="Qoqshol">Qoqshol</option>
            <option value="Qizamiq">Qizamiq</option>
            <option value="Boshqa">Boshqa (o'zingiz yozing)</option>
          </Select>
          {progressForm.vaccine_type === 'Boshqa' && (
            <Input label="Vaksina nomini kiriting" value={progressForm.custom_vaccine} onChange={e => setProgressForm(p => ({ ...p, custom_vaccine: e.target.value }))} required placeholder="Masalan: Hepatit C, Vabo..." />
          )}
          <Textarea label={t('progress.description')} value={progressForm.description} onChange={e => setProgressForm(p => ({ ...p, description: e.target.value }))} required />
          <Input label={t('progress.date')} type="date" value={progressForm.record_date} onChange={e => setProgressForm(p => ({ ...p, record_date: e.target.value }))} required />
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('progress.photo')}</label>
            <input type="file" accept="image/*" onChange={handlePhotoChange} className="text-sm text-gray-500" />
            {photoPreview && <img src={photoPreview} alt="preview" className="w-full h-32 object-cover rounded-lg mt-1" />}
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => { setAddProgressModal(false); setPhotoPreview(null); }}>{t('patients.cancel')}</Button>
            <Button loading={saving} onClick={handleAddProgress}>{t('patients.save')}</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!selectedRecord} onClose={() => setSelectedRecord(null)} title={selectedRecord?.title || ''}>
        {selectedRecord && (
          <div className="flex flex-col gap-4">
            {selectedRecord.photo_path && (
              <img src={"/" + selectedRecord.photo_path} alt={selectedRecord.title} className="w-full h-56 object-cover rounded-lg" />
            )}
            <div className="flex justify-between items-center">
              <span className="inline-block text-sm bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-3 py-1 rounded-full">{selectedRecord.vaccine_type}</span>
              <span className="text-sm text-gray-500">{selectedRecord.record_date}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Tavsif:</p>
              <p className="text-gray-900 dark:text-white">{selectedRecord.description}</p>
            </div>
            <p className="text-xs text-gray-400">Qo'shilgan: {new Date(selectedRecord.created_at).toLocaleString()}</p>
          </div>
        )}
      </Modal>

      <Modal open={deleteConfirm} onClose={() => setDeleteConfirm(false)} title={t('patients.confirmDelete')}>
        <div className="flex gap-3 justify-end mt-4">
          <Button variant="secondary" onClick={() => setDeleteConfirm(false)}>{t('patients.cancel')}</Button>
          <Button variant="danger" onClick={handleDelete}>{t('patients.delete')}</Button>
        </div>
      </Modal>
    </div>
  );
}

function ProfilePage() {
  const { t } = useTranslation();
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [credForm, setCredForm] = useState({ currentPassword: '', newLogin: '', newPassword: '' });
  const [saving, setSaving] = useState(false);
  const [credSaving, setCredSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  const handleProfileSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try { const { data } = await clientApi.updateProfile(form); updateUser(data); toast.success(t('profile.updateSuccess')); }
    catch { toast.error(t('common.error')); } finally { setSaving(false); }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const { data } = await clientApi.updatePhoto(fd);
      updateUser({ photo_path: data.photo_path });
      toast.success('Rasm yangilandi');
    } catch { toast.error(t('common.error')); } finally { setPhotoUploading(false); }
  };

  const handleTheme = async (theme) => {
    try { const { data } = await clientApi.updateProfile({ theme }); updateUser(data); } catch {}
  };

  const handleLanguage = async (language) => {
    try { const { data } = await clientApi.updateProfile({ language }); updateUser(data); } catch {}
  };

  const handleCredentials = async (e) => {
    e.preventDefault(); setCredSaving(true);
    try { await clientApi.updateCredentials(credForm); toast.success(t('profile.credentialsUpdated')); setCredForm({ currentPassword: '', newLogin: '', newPassword: '' }); }
    catch (err) { toast.error(err.response?.data?.message || t('common.error')); } finally { setCredSaving(false); }
  };

  return (
    <div className="p-4 max-w-lg mx-auto">
      <BackButton />
      <div className="flex flex-col items-center gap-3 mb-6">
        <div className="relative">
          <Avatar name={user?.name || user?.login} photoPath={user?.photo_path} size="lg" />
          <label className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full w-7 h-7 flex items-center justify-center cursor-pointer text-sm hover:bg-blue-600 transition-colors">
            {photoUploading ? '...' : '📷'}
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </label>
        </div>
        <div className="text-center">
          <p className="font-semibold text-gray-900 dark:text-white">{user?.name || user?.login}</p>
          <p className="text-sm text-gray-500">{user?.login}</p>
        </div>
      </div>

      <form onSubmit={handleProfileSave} className="flex flex-col gap-4 mb-6">
        <Input label={t('profile.name')} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        <Input label={t('profile.phone')} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
        <Button type="submit" loading={saving}>{t('patients.save')}</Button>
      </form>

      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.theme')}</span>
          <div className="flex gap-2">
            <Button size="sm" variant={user?.theme === 'light' ? 'primary' : 'secondary'} onClick={() => handleTheme('light')}>{t('profile.themeLight')}</Button>
            <Button size="sm" variant={user?.theme === 'dark' ? 'primary' : 'secondary'} onClick={() => handleTheme('dark')}>{t('profile.themeDark')}</Button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.language')}</span>
          <div className="flex gap-2">
            {['uz', 'ru', 'en'].map(lang => (
              <Button key={lang} size="sm" variant={user?.language === lang ? 'primary' : 'secondary'} onClick={() => handleLanguage(lang)}>{lang.toUpperCase()}</Button>
            ))}
          </div>
        </div>
      </div>

      <form onSubmit={handleCredentials} className="flex flex-col gap-4 mb-6">
        <h3 className="font-medium text-gray-900 dark:text-white">{t('profile.changeCredentials')}</h3>
        <Input label={t('profile.currentPassword')} type="password" value={credForm.currentPassword} onChange={e => setCredForm(p => ({ ...p, currentPassword: e.target.value }))} required />
        <Input label={t('profile.newLogin')} value={credForm.newLogin} onChange={e => setCredForm(p => ({ ...p, newLogin: e.target.value }))} />
        <Input label={t('profile.newPassword')} type="password" value={credForm.newPassword} onChange={e => setCredForm(p => ({ ...p, newPassword: e.target.value }))} />
        <Button type="submit" loading={credSaving} variant="secondary">{t('patients.save')}</Button>
      </form>

      <Button variant="danger" className="w-full" onClick={logout}>{t('nav.logout')}</Button>
    </div>
  );
}

function ExcelPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    patientsApi.list('').then(r => setPatients(r.data)).catch(() => {});
  }, []);

  const handleAsk = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const patientInfo = patients.map(p => `- ${p.full_name} (${p.passport}, tel: ${p.phone}, reg: ${p.registration_date})`).join('\n');
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Sen tibbiy CRM tizimida yordam beruvchi AI assistantsan. Quyida bemorlar ro'yxati:\n${patientInfo}\n\nSavol: ${prompt}\n\nJavobni qisqa va aniq ber.`
          }]
        })
      });
      const data = await response.json();
      setResult(data.content?.[0]?.text || 'Javob olishda xatolik');
    } catch {
      setResult('Xatolik yuz berdi. Iltimos qayta urining.');
    } finally { setLoading(false); }
  };

  const exportToCSV = () => {
    if (patients.length === 0) { toast.error('Bemorlar yo\'q'); return; }
    const headers = ['FIO', 'Pasport', 'Telefon', 'Tug\'ilgan sana', 'Qon guruhi', 'Ro\'yxat sanasi'];
    const rows = patients.map(p => [p.full_name, p.passport, p.phone, p.birth_date || '', p.blood_group || '', p.registration_date]);
    const csv = [headers, ...rows].map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'bemorlar.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV yuklab olindi!');
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">📊 Excel & AI Yordam</h2>
        <Button variant="secondary" size="sm" onClick={exportToCSV}>⬇ CSV Yuklab olish</Button>
      </div>

      <Card className="mb-4">
        <h3 className="font-medium text-gray-900 dark:text-white mb-3">🤖 AI Yordam</h3>
        <p className="text-sm text-gray-500 mb-3">Bemorlar haqida savol bering yoki ma'lumot so'rang</p>
        <Textarea
          placeholder="Masalan: Nechta bemor bor? Qaysi bemorning qon guruhi A+? ..."
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          className="mb-3"
        />
        <Button onClick={handleAsk} loading={loading} className="w-full">
          {loading ? 'Javob kutilmoqda...' : '🤖 AI dan so\'rash'}
        </Button>
        {result && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{result}</p>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-medium text-gray-900 dark:text-white mb-3">📋 Bemorlar jadvali</h3>
        <p className="text-sm text-gray-500 mb-3">Jami: <strong>{patients.length}</strong> bemor</p>
        {patients.length === 0 ? <EmptyState message="Bemorlar yo'q" icon="📋" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 text-gray-500">FIO</th>
                  <th className="text-left py-2 text-gray-500">Pasport</th>
                  <th className="text-left py-2 text-gray-500">Telefon</th>
                  <th className="text-left py-2 text-gray-500">Sana</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {patients.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-2 text-gray-900 dark:text-white font-medium">{p.full_name}</td>
                    <td className="py-2 text-gray-500">{p.passport}</td>
                    <td className="py-2 text-gray-500">{p.phone}</td>
                    <td className="py-2 text-gray-500">{p.registration_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function ClientDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('patients');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <span className="text-xl">💉</span>
          <span className="font-semibold text-gray-900 dark:text-white flex-1">VaccinePro</span>
          <button onClick={() => navigate('/dashboard/profile')}>
            <Avatar name={user?.name || user?.login} photoPath={user?.photo_path} size="sm" />
          </button>
        </div>
      </header>
      <main className="max-w-2xl mx-auto">
        <Routes>
          <Route index element={
            activeTab === 'patients' ? <PatientsList /> :
            activeTab === 'add' ? <AddPatient /> :
            <ExcelPage />
          } />
          <Route path="patient/:id" element={<PatientPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Routes>
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-10">
        <div className="max-w-2xl mx-auto flex">
          <button onClick={() => { setActiveTab('patients'); navigate('/dashboard'); }} className={"flex-1 py-3 flex flex-col items-center gap-1 text-xs font-medium transition-colors " + (activeTab === 'patients' ? 'text-blue-500' : 'text-gray-500')}>
            <span className="text-lg">👥</span>{t('nav.myPatients')}
          </button>
          <button onClick={() => { setActiveTab('add'); navigate('/dashboard'); }} className={"flex-1 py-3 flex flex-col items-center gap-1 text-xs font-medium transition-colors " + (activeTab === 'add' ? 'text-blue-500' : 'text-gray-500')}>
            <span className="text-lg">➕</span>{t('nav.addPatient')}
          </button>
          <button onClick={() => { setActiveTab('excel'); navigate('/dashboard'); }} className={"flex-1 py-3 flex flex-col items-center gap-1 text-xs font-medium transition-colors " + (activeTab === 'excel' ? 'text-blue-500' : 'text-gray-500')}>
            <span className="text-lg">📊</span>Excel & AI
          </button>
        </div>
      </nav>
    </div>
  );
}
