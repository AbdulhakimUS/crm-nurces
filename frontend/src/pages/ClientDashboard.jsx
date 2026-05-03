import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { dashboardApi } from '../api/dashboard';
import { familiesApi } from '../api/families';
import { patientsApi } from '../api/patients';
import { importApi } from '../api/importApi';
import { adminApi, clientApi } from '../api/admin';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const RISK_CONFIG = {
  pregnant: { label: 'Pregnant', emoji: '🤰', color: 'border-blue-400 text-blue-600 bg-blue-50' },
  child05:  { label: 'Child 0–5', emoji: '👶', color: 'border-green-400 text-green-600 bg-green-50' },
  chronic:  { label: 'Chronic', emoji: '💊', color: 'border-yellow-400 text-yellow-600 bg-yellow-50' },
  disabled: { label: 'Disabled', emoji: '♿', color: 'border-red-400 text-red-600 bg-red-50' },
  normal:   { label: 'Normal', emoji: '👤', color: 'border-gray-300 text-gray-500 bg-gray-50' },
};

function RiskBadge({ category }) {
  const cfg = RISK_CONFIG[category] || RISK_CONFIG.normal;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${cfg.color}`}>
      {cfg.emoji} {cfg.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    pending:   'bg-yellow-100 text-yellow-700 border-yellow-300',
    completed: 'bg-green-100 text-green-700 border-green-300',
    missed:    'bg-red-100 text-red-700 border-red-300',
  }[status] || 'bg-gray-100 text-gray-600 border-gray-300';
  return <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold capitalize ${cfg}`}>{status}</span>;
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} max-h-[90vh] overflow-y-auto`}>
        <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="font-bold text-lg text-gray-900">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
      {children}
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <Field label={label}>
      <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" {...props} />
    </Field>
  );
}

function Select({ label, children, ...props }) {
  return (
    <Field label={label}>
      <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white" {...props}>
        {children}
      </select>
    </Field>
  );
}

function Textarea({ label, ...props }) {
  return (
    <Field label={label}>
      <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none" rows={3} {...props} />
    </Field>
  );
}

function Btn({ children, onClick, variant = 'primary', sm, type = 'button', disabled, className = '' }) {
  const base = `inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl transition-all ${sm ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'} disabled:opacity-50 ${className}`;
  const vars = {
    primary: 'bg-gray-900 text-white hover:bg-gray-700 shadow-sm',
    outline: 'border border-gray-200 text-gray-700 hover:bg-gray-50',
    danger:  'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100',
    green:   'bg-green-600 text-white hover:bg-green-700',
    blue:    'bg-blue-600 text-white hover:bg-blue-700',
  };
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${vars[variant]}`}>{children}</button>;
}

// ── PATIENT RECORD MODAL ─────────────────────────────────
function PatientRecord({ patientId, clientId, onClose, onDeleted }) {
  const [tab, setTab] = useState('info');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [addingVisit, setAddingVisit] = useState(false);
  const [addingHistory, setAddingHistory] = useState(false);
  const [addingVaccine, setAddingVaccine] = useState(false);
  const [addingMed, setAddingMed] = useState(false);
  const [visitForm, setVisitForm] = useState({ visit_date: new Date().toISOString().split('T')[0], next_visit_date: '', status: 'pending' });
  const [historyForm, setHistoryForm] = useState({ visit_date: new Date().toISOString().split('T')[0], diagnosis: '', medication: '', notes: '' });
  const [vaccineForm, setVaccineForm] = useState({ vaccine_name: '', date_given: new Date().toISOString().split('T')[0], next_date: '' });
  const [medForm, setMedForm] = useState({ medicine_name: '', quantity: '', times_per_day: 1, duration_days: 1, date_given: new Date().toISOString().split('T')[0] });
  const [imageCaption, setImageCaption] = useState('');
  const fileRef = useRef();

  const load = async () => {
    setLoading(true);
    try {
      const r = await patientsApi.get(patientId);
      setData(r.data);
      setEditForm(r.data.patient);
    } catch { toast.error('Failed to load patient'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [patientId]);

  const saveEdit = async () => {
    try {
      await patientsApi.update(patientId, editForm);
      toast.success('Saved'); setEditMode(false); load();
    } catch { toast.error('Save failed'); }
  };

  const deletePatient = async () => {
    if (!confirm('Delete this patient and all their records?')) return;
    try { await patientsApi.delete(patientId); toast.success('Deleted'); onDeleted?.(); onClose(); }
    catch { toast.error('Delete failed'); }
  };

  const addVisit = async () => {
    try { await patientsApi.addVisit(patientId, visitForm); toast.success('Visit added'); setAddingVisit(false); load(); }
    catch { toast.error('Failed'); }
  };

  const addHistory = async () => {
    try { await patientsApi.addHistory(patientId, historyForm); toast.success('History added'); setAddingHistory(false); load(); }
    catch { toast.error('Failed'); }
  };

  const addVaccine = async () => {
    try { await patientsApi.addVaccine(patientId, vaccineForm); toast.success('Vaccine added'); setAddingVaccine(false); load(); }
    catch { toast.error('Failed'); }
  };

  const addMed = async () => {
    try { await patientsApi.addMedication(patientId, medForm); toast.success('Medication added'); setAddingMed(false); load(); }
    catch { toast.error('Failed'); }
  };

  const uploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('photo', file);
    try {
      const r = await clientApi.updatePhoto(formData);
      await patientsApi.addImage(patientId, { image_url: r.data.photo_path, caption: imageCaption });
      toast.success('Image uploaded'); setImageCaption(''); load();
    } catch { toast.error('Upload failed'); }
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!data) return null;

  const { patient, visits = [], history = [], vaccines = [], medications = [], images = [] } = data;
  const tabs = ['Info','History','Visits','Vaccines','Meds','Images'];

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{patient.full_name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              ID: {patient.passport} {patient.birth_date && `· DOB: ${formatDate(patient.birth_date)}`} {patient.blood_group && `· ${patient.blood_group}`}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {patient.risk_category && patient.risk_category !== 'normal' && <RiskBadge category={patient.risk_category} />}
              {visits[0]?.next_visit_date && isOverdue(visits[0].next_visit_date) && (
                <span className="px-2 py-0.5 rounded-full border border-red-300 bg-red-50 text-red-600 text-xs font-semibold">Next visit overdue</span>
              )}
              {vaccines[0]?.next_date && isOverdue(vaccines[0].next_date) && (
                <span className="px-2 py-0.5 rounded-full border border-red-300 bg-red-50 text-red-600 text-xs font-semibold">Vaccine overdue</span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mt-4 flex-wrap">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t.toLowerCase())}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${tab === t.toLowerCase() ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* INFO TAB */}
      {tab === 'info' && (
        <div className="space-y-4">
          {editMode ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Full Name" value={editForm.full_name||''} onChange={e => setEditForm(p=>({...p,full_name:e.target.value}))} />
                <Input label="Passport" value={editForm.passport||''} onChange={e => setEditForm(p=>({...p,passport:e.target.value}))} />
                <Input label="Date of Birth" type="date" value={editForm.birth_date||''} onChange={e => setEditForm(p=>({...p,birth_date:e.target.value}))} />
                <Select label="Blood Group" value={editForm.blood_group||''} onChange={e => setEditForm(p=>({...p,blood_group:e.target.value}))}>
                  {['','A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g=><option key={g} value={g}>{g||'Select'}</option>)}
                </Select>
                <Select label="Risk Category" value={editForm.risk_category||'normal'} onChange={e => setEditForm(p=>({...p,risk_category:e.target.value}))}>
                  {Object.entries(RISK_CONFIG).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}
                </Select>
                <Input label="Height (cm)" type="number" value={editForm.height||''} onChange={e => setEditForm(p=>({...p,height:e.target.value}))} />
                <Input label="Weight (kg)" type="number" value={editForm.weight||''} onChange={e => setEditForm(p=>({...p,weight:e.target.value}))} />
                <Input label="Blood Pressure" value={editForm.blood_pressure||''} onChange={e => setEditForm(p=>({...p,blood_pressure:e.target.value}))} placeholder="120/80" />
              </div>
              <Textarea label="Notes" value={editForm.notes||''} onChange={e => setEditForm(p=>({...p,notes:e.target.value}))} />
              <div className="flex gap-2">
                <Btn variant="outline" onClick={() => setEditMode(false)}>Cancel</Btn>
                <Btn onClick={saveEdit}>Save Changes</Btn>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[['Height', patient.height ? `${patient.height} cm` : '—'],
                  ['Weight', patient.weight ? `${patient.weight} kg` : '—'],
                  ['BP', patient.blood_pressure || '—'],
                  ['Blood Group', patient.blood_group || '—']].map(([l,v]) => (
                  <div key={l} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 font-medium">{l}</p>
                    <p className="text-base font-bold text-gray-900 mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
              {patient.notes && (
                <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-sm text-gray-700">
                  📝 {patient.notes}
                </div>
              )}
              <button onClick={() => setEditMode(true)} className="w-full py-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium text-sm transition border border-gray-200">
                ✏️ Edit Patient Info
              </button>
            </>
          )}
          <button onClick={deletePatient} className="flex items-center gap-2 text-red-500 hover:text-red-700 text-sm font-semibold border border-red-200 rounded-xl px-4 py-2.5 hover:bg-red-50 transition">
            🗑️ Delete Patient
          </button>
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <div className="space-y-3">
          {addingHistory ? (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
              <div className="grid grid-cols-1 gap-3">
                <Input label="Date" type="date" value={historyForm.visit_date} onChange={e=>setHistoryForm(p=>({...p,visit_date:e.target.value}))} />
                <Input label="Diagnosis" value={historyForm.diagnosis} onChange={e=>setHistoryForm(p=>({...p,diagnosis:e.target.value}))} />
                <Input label="Medication" value={historyForm.medication} onChange={e=>setHistoryForm(p=>({...p,medication:e.target.value}))} />
                <Textarea label="Notes" value={historyForm.notes} onChange={e=>setHistoryForm(p=>({...p,notes:e.target.value}))} />
              </div>
              <div className="flex gap-2"><Btn variant="outline" onClick={()=>setAddingHistory(false)}>Cancel</Btn><Btn onClick={addHistory}>Save</Btn></div>
            </div>
          ) : (
            <button onClick={()=>setAddingHistory(true)} className="w-full py-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium text-sm transition border border-gray-200">
              + Add Visit Record
            </button>
          )}
          {history.map(h => (
            <div key={h.id} className="border border-gray-100 rounded-xl p-4 relative">
              <button onClick={async()=>{await patientsApi.deleteHistory(patientId,h.id);load();}} className="absolute top-3 right-3 text-gray-300 hover:text-red-500 transition">🗑</button>
              <p className="text-xs text-gray-400 font-medium">📅 {formatDate(h.visit_date)}</p>
              <p className="font-bold text-gray-900 mt-1">{h.diagnosis || 'Visit'}</p>
              {h.medication && <p className="text-sm text-gray-600 mt-0.5">💊 {h.medication}</p>}
              {h.notes && <p className="text-sm text-gray-400 italic mt-1">{h.notes}</p>}
            </div>
          ))}
          {!history.length && !addingHistory && <p className="text-center text-gray-400 py-8 text-sm">No history records yet</p>}
        </div>
      )}

      {/* VISITS TAB */}
      {tab === 'visits' && (
        <div className="space-y-3">
          {addingVisit ? (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
              <Input label="Visit Date" type="date" value={visitForm.visit_date} onChange={e=>setVisitForm(p=>({...p,visit_date:e.target.value}))} />
              <Input label="Next Visit Date" type="date" value={visitForm.next_visit_date} onChange={e=>setVisitForm(p=>({...p,next_visit_date:e.target.value}))} />
              <Select label="Status" value={visitForm.status} onChange={e=>setVisitForm(p=>({...p,status:e.target.value}))}>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="missed">Missed</option>
              </Select>
              <div className="flex gap-2"><Btn variant="outline" onClick={()=>setAddingVisit(false)}>Cancel</Btn><Btn onClick={addVisit}>Save</Btn></div>
            </div>
          ) : (
            <button onClick={()=>setAddingVisit(true)} className="w-full py-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium text-sm transition border border-gray-200">
              + Add Visit
            </button>
          )}
          {visits.map(v => (
            <div key={v.id} className="border border-gray-100 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">📅 {formatDate(v.visit_date)}</p>
                <p className="text-sm text-gray-600 mt-0.5">
                  Next: {formatDate(v.next_visit_date)}
                  {isOverdue(v.next_visit_date) && v.status !== 'completed' && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200 text-xs">overdue</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={v.status} />
                <button onClick={async()=>{await patientsApi.deleteVisit(patientId,v.id);load();}} className="text-gray-300 hover:text-red-500 transition">🗑</button>
              </div>
            </div>
          ))}
          {!visits.length && !addingVisit && <p className="text-center text-gray-400 py-8 text-sm">No visits recorded yet</p>}
        </div>
      )}

      {/* VACCINES TAB */}
      {tab === 'vaccines' && (
        <div className="space-y-3">
          {addingVaccine ? (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
              <Input label="Vaccine Name" value={vaccineForm.vaccine_name} onChange={e=>setVaccineForm(p=>({...p,vaccine_name:e.target.value}))} />
              <Input label="Date Given" type="date" value={vaccineForm.date_given} onChange={e=>setVaccineForm(p=>({...p,date_given:e.target.value}))} />
              <Input label="Next Date" type="date" value={vaccineForm.next_date} onChange={e=>setVaccineForm(p=>({...p,next_date:e.target.value}))} />
              <div className="flex gap-2"><Btn variant="outline" onClick={()=>setAddingVaccine(false)}>Cancel</Btn><Btn onClick={addVaccine}>Save</Btn></div>
            </div>
          ) : (
            <button onClick={()=>setAddingVaccine(true)} className="w-full py-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium text-sm transition border border-gray-200">
              + Add Vaccination
            </button>
          )}
          {vaccines.map(v => (
            <div key={v.id} className="border border-gray-100 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">💉 {v.vaccine_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">Given: {formatDate(v.date_given)}</p>
                <p className="text-xs text-gray-500">
                  Next: {formatDate(v.next_date)}
                  {isOverdue(v.next_date) && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200 text-xs">overdue</span>
                  )}
                </p>
              </div>
              <button onClick={async()=>{await patientsApi.deleteVaccine(patientId,v.id);load();}} className="text-gray-300 hover:text-red-500 transition">🗑</button>
            </div>
          ))}
          {!vaccines.length && !addingVaccine && <p className="text-center text-gray-400 py-8 text-sm">No vaccines recorded yet</p>}
        </div>
      )}

      {/* MEDS TAB */}
      {tab === 'meds' && (
        <div className="space-y-3">
          {addingMed ? (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
              <Input label="Medicine Name" value={medForm.medicine_name} onChange={e=>setMedForm(p=>({...p,medicine_name:e.target.value}))} />
              <div className="grid grid-cols-3 gap-3">
                <Input label="Quantity" value={medForm.quantity} onChange={e=>setMedForm(p=>({...p,quantity:e.target.value}))} placeholder="60 tablets" />
                <Input label="Times/day" type="number" min="1" value={medForm.times_per_day} onChange={e=>setMedForm(p=>({...p,times_per_day:e.target.value}))} />
                <Input label="Days" type="number" min="1" value={medForm.duration_days} onChange={e=>setMedForm(p=>({...p,duration_days:e.target.value}))} />
              </div>
              <Input label="Date Given" type="date" value={medForm.date_given} onChange={e=>setMedForm(p=>({...p,date_given:e.target.value}))} />
              <div className="flex gap-2"><Btn variant="outline" onClick={()=>setAddingMed(false)}>Cancel</Btn><Btn onClick={addMed}>Save</Btn></div>
            </div>
          ) : (
            <button onClick={()=>setAddingMed(true)} className="w-full py-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium text-sm transition border border-gray-200">
              + Add Medication
            </button>
          )}
          {medications.map(m => (
            <div key={m.id} className="border border-gray-100 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">💊 {m.medicine_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {m.quantity && `${m.quantity} · `}{m.times_per_day}x/day · {m.duration_days} days · {formatDate(m.date_given)}
                </p>
              </div>
              <button onClick={async()=>{await patientsApi.deleteMedication(patientId,m.id);load();}} className="text-gray-300 hover:text-red-500 transition">🗑</button>
            </div>
          ))}
          {!medications.length && !addingMed && <p className="text-center text-gray-400 py-8 text-sm">No medications recorded yet</p>}
        </div>
      )}

      {/* IMAGES TAB */}
      {tab === 'images' && (
        <div className="space-y-3">
          <Input label="Caption (optional)" value={imageCaption} onChange={e=>setImageCaption(e.target.value)} placeholder="e.g. Wound progress" />
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadImage} />
          <button onClick={()=>fileRef.current.click()} className="w-full py-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium text-sm transition border border-gray-200">
            📷 Upload Image
          </button>
          <div className="grid grid-cols-2 gap-3">
            {images.map(img => (
              <div key={img.id} className="relative rounded-xl overflow-hidden border border-gray-100">
                <img src={img.image_url} alt={img.caption} className="w-full h-32 object-cover" />
                {img.caption && <p className="text-xs text-gray-600 p-2">{img.caption}</p>}
                <button onClick={async()=>{await patientsApi.deleteImage(patientId,img.id);load();}}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600">✕</button>
              </div>
            ))}
          </div>
          {!images.length && <p className="text-center text-gray-400 py-8 text-sm">No images uploaded yet</p>}
        </div>
      )}
    </div>
  );
}

// ── ADD PATIENT MODAL ─────────────────────────────────────
function AddPatientModal({ familyId, families, onSaved, onClose }) {
  const [form, setForm] = useState({
    family_id: familyId || '',
    full_name: '', passport: '', birth_date: '',
    blood_group: '', risk_category: 'normal',
    height: '', weight: '', blood_pressure: '', notes: ''
  });
  const [saving, setSaving] = useState(false);
  const set = k => e => setForm(p=>({...p,[k]:e.target.value}));

  const save = async () => {
    if (!form.full_name || !form.passport) { toast.error('Name and passport required'); return; }
    setSaving(true);
    try { await patientsApi.create(form); toast.success('Patient added'); onSaved(); }
    catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      {!familyId && (
        <Select label="Family" value={form.family_id} onChange={set('family_id')}>
          <option value="">No family</option>
          {families.map(f=><option key={f.id} value={f.id}>{f.head_name}</option>)}
        </Select>
      )}
      <Input label="Full Name (F.I.SH)" value={form.full_name} onChange={set('full_name')} placeholder="Lastname Firstname Patronymic" required />
      <Input label="Passport ID" value={form.passport} onChange={set('passport')} placeholder="AA1234567" required />
      <Input label="Date of Birth" type="date" value={form.birth_date} onChange={set('birth_date')} />
      <Select label="Risk Category" value={form.risk_category} onChange={set('risk_category')}>
        {Object.entries(RISK_CONFIG).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Height (cm)" type="number" value={form.height} onChange={set('height')} placeholder="165" />
        <Input label="Weight (kg)" type="number" value={form.weight} onChange={set('weight')} placeholder="70" />
        <Input label="Blood Pressure" value={form.blood_pressure} onChange={set('blood_pressure')} placeholder="120/80" />
        <Select label="Blood Group" value={form.blood_group} onChange={set('blood_group')}>
          {['','A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g=><option key={g} value={g}>{g||'Select'}</option>)}
        </Select>
      </div>
      <Textarea label="Notes" value={form.notes} onChange={set('notes')} placeholder="Additional notes..." />
      <div className="flex gap-2 pt-2">
        <Btn variant="outline" onClick={onClose}>Cancel</Btn>
        <Btn onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Patient'}</Btn>
      </div>
    </div>
  );
}

// ── HOME / DASHBOARD ──────────────────────────────────────
function HomeDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.getStats()
      .then(r => setStats(r.data))
      .catch(() => toast.error('Failed to load stats'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!stats) return null;

  const riskMap = { pregnant: '🤰', child05: '👶', chronic: '💊', disabled: '♿' };
  const riskColors = { pregnant: 'border-blue-400 text-blue-600', child05: 'border-green-400 text-green-600', chronic: 'border-yellow-400 text-yellow-600', disabled: 'border-red-400 text-red-600' };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: '👥', val: stats.total_patients, label: 'Total Patients', color: 'text-blue-600' },
          { icon: '⚠️', val: stats.missed_visits, label: 'Missed Visits', color: 'text-red-500' },
          { icon: '💉', val: stats.upcoming_vaccines, label: 'Upcoming Vaccines', color: 'text-yellow-500' },
          { icon: '🏠', val: stats.total_families, label: 'Families', color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="text-3xl mb-2">{s.icon}</div>
            <div className={`text-3xl font-black ${s.color}`}>{s.val}</div>
            <div className="text-sm text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Risk Groups */}
      {stats.risk_groups?.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-3">Risk Groups</h3>
          <div className="space-y-2">
            {stats.risk_groups.map(rg => (
              <div key={rg.risk_category} className={`flex items-center justify-between p-3 rounded-xl border ${riskColors[rg.risk_category] || 'border-gray-200 text-gray-600'}`}>
                <span className="font-semibold text-sm">
                  {riskMap[rg.risk_category] || '👤'} {RISK_CONFIG[rg.risk_category]?.label || rg.risk_category}
                </span>
                <span className="font-bold">{rg.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reminders */}
      {stats.reminders?.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-3">Upcoming Reminders</h3>
          <div className="space-y-2">
            {stats.reminders.map((r, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <p className="font-semibold text-sm text-gray-900">{r.full_name}</p>
                  <p className="text-xs text-gray-500">{r.type}</p>
                </div>
                <span className="text-red-500 font-bold text-xs">Overdue</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── FAMILIES PAGE ─────────────────────────────────────────
function FamiliesPage() {
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [addForm, setAddForm] = useState({ head_name: '', address: '', phone: '' });
  const [showAddMember, setShowAddMember] = useState(false);
  const [editFamily, setEditFamily] = useState(null);

  const load = () => familiesApi.list().then(r => setFamilies(r.data)).catch(()=>toast.error('Failed')).finally(()=>setLoading(false));
  useEffect(() => { load(); }, []);

  const loadFamily = async (id) => {
    try { const r = await familiesApi.get(id); setSelectedFamily(r.data); }
    catch { toast.error('Failed to load family'); }
  };

  const addFamily = async () => {
    if (!addForm.head_name) { toast.error('Name required'); return; }
    try { await familiesApi.create(addForm); toast.success('Family added'); setShowAdd(false); setAddForm({head_name:'',address:'',phone:''}); load(); }
    catch { toast.error('Failed'); }
  };

  const deleteFamily = async (id) => {
    if (!confirm('Delete this family and all members?')) return;
    try { await familiesApi.delete(id); toast.success('Deleted'); setSelectedFamily(null); load(); }
    catch { toast.error('Failed'); }
  };

  const saveEditFamily = async () => {
    try { await familiesApi.update(editFamily.id, editFamily); toast.success('Updated'); setEditFamily(null); loadFamily(editFamily.id); load(); }
    catch { toast.error('Failed'); }
  };

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">Families</h2>
        <Btn onClick={() => setShowAdd(true)}>+ Add</Btn>
      </div>

      {families.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">🏠</div>
          <p className="font-medium">No families yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {families.map(f => (
            <div key={f.id} onClick={() => loadFamily(f.id)}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:border-blue-200 hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-900">🏠 {f.head_name}</p>
                  {f.address && <p className="text-sm text-gray-500 mt-0.5">📍 {f.address}</p>}
                  {f.phone && <p className="text-sm text-gray-500">📞 {f.phone}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {f.risk_categories?.filter(Boolean).map(r => <RiskBadge key={r} category={r} />)}
                  </div>
                </div>
                <span className="text-blue-600 font-bold text-lg">{f.member_count}<span className="text-xs text-gray-400 font-normal ml-1">members</span></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Family Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Family">
        <div className="space-y-3">
          <Input label="Head of Family" value={addForm.head_name} onChange={e=>setAddForm(p=>({...p,head_name:e.target.value}))} placeholder="Full name" />
          <Input label="Address" value={addForm.address} onChange={e=>setAddForm(p=>({...p,address:e.target.value}))} placeholder="Street, district" />
          <Input label="Phone" value={addForm.phone} onChange={e=>setAddForm(p=>({...p,phone:e.target.value}))} placeholder="+998..." />
          <div className="flex gap-2 pt-2">
            <Btn variant="outline" onClick={() => setShowAdd(false)}>Cancel</Btn>
            <Btn onClick={addFamily}>Save Family</Btn>
          </div>
        </div>
      </Modal>

      {/* Family Detail Modal */}
      <Modal open={!!selectedFamily && !selectedPatient} onClose={() => setSelectedFamily(null)} title={selectedFamily?.family?.head_name || ''} wide>
        {selectedFamily && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Btn sm variant="outline" onClick={() => setEditFamily({ ...selectedFamily.family })}>✏️</Btn>
              <Btn sm variant="danger" onClick={() => deleteFamily(selectedFamily.family.id)}>🗑️</Btn>
            </div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Members ({selectedFamily.members?.length || 0})</h3>
              <Btn sm onClick={() => setShowAddMember(true)}>+ Add Member</Btn>
            </div>
            {selectedFamily.members?.length === 0 && (
              <p className="text-center text-gray-400 py-8">No members yet</p>
            )}
            <div className="space-y-2">
              {selectedFamily.members?.map(m => (
                <div key={m.id} onClick={() => setSelectedPatient(m.id)}
                  className="border border-gray-100 rounded-xl p-4 cursor-pointer hover:border-blue-200 transition">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{m.full_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        DOB: {formatDate(m.birth_date)} · {m.passport}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {m.risk_category && m.risk_category !== 'normal' && <RiskBadge category={m.risk_category} />}
                        {m.next_visit && isOverdue(m.next_visit) && (
                          <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200 text-xs font-semibold">Visit overdue</span>
                        )}
                        {m.next_vaccine && isOverdue(m.next_vaccine) && (
                          <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200 text-xs font-semibold">Vaccine overdue</span>
                        )}
                      </div>
                    </div>
                    <span className="text-gray-400">›</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Add Member Modal */}
      <Modal open={showAddMember} onClose={() => setShowAddMember(false)} title="Add Member">
        <AddPatientModal
          familyId={selectedFamily?.family?.id}
          families={families}
          onSaved={() => { setShowAddMember(false); loadFamily(selectedFamily.family.id); }}
          onClose={() => setShowAddMember(false)}
        />
      </Modal>

      {/* Edit Family Modal */}
      <Modal open={!!editFamily} onClose={() => setEditFamily(null)} title="Edit Family">
        {editFamily && (
          <div className="space-y-3">
            <Input label="Head of Family" value={editFamily.head_name} onChange={e=>setEditFamily(p=>({...p,head_name:e.target.value}))} />
            <Input label="Address" value={editFamily.address||''} onChange={e=>setEditFamily(p=>({...p,address:e.target.value}))} />
            <Input label="Phone" value={editFamily.phone||''} onChange={e=>setEditFamily(p=>({...p,phone:e.target.value}))} />
            <div className="flex gap-2">
              <Btn variant="outline" onClick={() => setEditFamily(null)}>Cancel</Btn>
              <Btn onClick={saveEditFamily}>Save</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Patient Record Modal */}
      <Modal open={!!selectedPatient} onClose={() => setSelectedPatient(null)} title="Patient Record" wide>
        {selectedPatient && (
          <PatientRecord
            patientId={selectedPatient}
            onClose={() => setSelectedPatient(null)}
            onDeleted={() => { setSelectedPatient(null); loadFamily(selectedFamily.family.id); }}
          />
        )}
      </Modal>
    </div>
  );
}

// ── PATIENTS PAGE ─────────────────────────────────────────
function PatientsPage() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [aiSearch, setAiSearch] = useState('');
  const [risk, setRisk] = useState('all');
  const [visitStatus, setVisitStatus] = useState('all');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [families, setFamilies] = useState([]);
  const [showAddPatient, setShowAddPatient] = useState(false);

  const load = async (params = {}) => {
    setLoading(true);
    try {
      const r = await patientsApi.list({ search, risk: risk !== 'all' ? risk : undefined, visit_status: visitStatus !== 'all' ? visitStatus : undefined, ...params });
      setPatients(r.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, risk, visitStatus]);
  useEffect(() => { familiesApi.list().then(r => setFamilies(r.data)).catch(()=>{}); }, []);

  const exportExcel = () => {
    const rows = patients.map(p => ({
      'Full Name': p.full_name, 'Passport': p.passport,
      'DOB': p.birth_date, 'Blood Group': p.blood_group,
      'Risk': p.risk_category, 'Family': p.family_name,
      'Height': p.height, 'Weight': p.weight, 'BP': p.blood_pressure,
      'Notes': p.notes,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Patients');
    XLSX.writeFile(wb, `patients_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Exported!');
  };

  const handleAiSearch = async () => {
    if (!aiSearch.trim()) return;
    toast('🤖 AI search coming soon!', { icon: '🤖' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900">All Patients</h2>
      </div>

      {/* AI Search */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5">
          <span className="text-lg">🤖</span>
          <input className="flex-1 text-sm outline-none" placeholder="e.g. show all pregnant patients..."
            value={aiSearch} onChange={e => setAiSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAiSearch()} />
        </div>
        <Btn onClick={handleAiSearch}>Search</Btn>
      </div>

      {/* Regular Search */}
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5">
        <span className="text-gray-400">🔍</span>
        <input className="flex-1 text-sm outline-none" placeholder="Search by name or passport ID..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Filters + Export + Import */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={risk} onChange={e => setRisk(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All Risk</option>
          {Object.entries(RISK_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
        </select>
        <select value={visitStatus} onChange={e => setVisitStatus(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All Visits</option>
          <option value="pending">⏳ Pending</option>
          <option value="completed">✅ Completed</option>
          <option value="missed">⚠️ Missed</option>
        </select>
        <button onClick={exportExcel}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-green-400 text-green-600 font-semibold text-sm hover:bg-green-50 transition">
          📤 Export
        </button>
        <button onClick={() => setShowImport(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-blue-400 text-blue-600 font-semibold text-sm hover:bg-blue-50 transition">
          📥 Import
        </button>
        <Btn sm onClick={() => setShowAddPatient(true)}>+ Add Patient</Btn>
      </div>

      <p className="text-sm text-gray-500">Showing {patients.length} patient{patients.length !== 1 ? 's' : ''}</p>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : patients.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><div className="text-5xl mb-3">👥</div><p className="font-medium">No patients found</p></div>
      ) : (
        <div className="space-y-3">
          {patients.map(p => (
            <div key={p.id} onClick={() => setSelectedPatient(p.id)}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:border-blue-200 hover:shadow-md transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900">{p.full_name}</p>
                    {p.risk_category && p.risk_category !== 'normal' && <RiskBadge category={p.risk_category} />}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    DOB: {formatDate(p.birth_date)} {p.blood_group && `· ${p.blood_group}`}
                  </p>
                  {p.family_name && <p className="text-xs text-gray-400 mt-0.5">🏠 {p.family_name}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.last_visit_status && <StatusBadge status={p.last_visit_status} />}
                    {p.next_visit_date && isOverdue(p.next_visit_date) && p.last_visit_status !== 'completed' && (
                      <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200 text-xs font-semibold">Visit overdue</span>
                    )}
                  </div>
                </div>
                <span className="text-gray-400 flex-shrink-0">›</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Patient Record Modal */}
      <Modal open={!!selectedPatient} onClose={() => setSelectedPatient(null)} title="Patient Record" wide>
        {selectedPatient && (
          <PatientRecord
            patientId={selectedPatient}
            onClose={() => setSelectedPatient(null)}
            onDeleted={() => { setSelectedPatient(null); load(); }}
          />
        )}
      </Modal>

      {/* Add Patient Modal */}
      <Modal open={showAddPatient} onClose={() => setShowAddPatient(false)} title="Add Patient">
        <AddPatientModal
          families={families}
          onSaved={() => { setShowAddPatient(false); load(); }}
          onClose={() => setShowAddPatient(false)}
        />
      </Modal>

      {/* Import Modal */}
      <Modal open={showImport} onClose={() => setShowImport(false)} title="Import Excel" wide>
        <ImportModal onClose={() => { setShowImport(false); load(); }} />
      </Modal>
    </div>
  );
}

// ── IMPORT MODAL ─────────────────────────────────────────
function ImportModal({ onClose }) {
  const [step, setStep] = useState('upload');
  const [analysis, setAnalysis] = useState(null);
  const [mapping, setMapping] = useState({});
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const fileRef = useRef();

  const analyze = async (f) => {
    setLoading(true);
    const fd = new FormData();
    fd.append('file', f);
    try {
      const r = await importApi.analyze(fd);
      setAnalysis(r.data);
      setMapping(r.data.mapping || {});
      setStep('mapping');
    } catch { toast.error('Analysis failed'); }
    finally { setLoading(false); }
  };

  const process = async () => {
    setLoading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('mapping', JSON.stringify(mapping));
    try {
      const r = await importApi.process(fd);
      setResults(r.data.results);
      setStep('results');
    } catch { toast.error('Import failed'); }
    finally { setLoading(false); }
  };

  if (step === 'upload') return (
    <div>
      <div onClick={() => fileRef.current.click()}
        className="border-2 border-dashed border-blue-300 rounded-2xl p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition">
        <div className="text-5xl mb-3">📊</div>
        <p className="font-bold text-gray-700">Drop Excel file here</p>
        <p className="text-sm text-gray-400 mt-1">Supports .xlsx · .xls · .csv</p>
        <p className="text-xs text-blue-500 mt-2">AI will auto-detect columns</p>
      </div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if(f){ setFile(f); analyze(f); } }} />
      {loading && <p className="text-center text-sm text-gray-500 mt-3 animate-pulse">🤖 AI analyzing...</p>}
    </div>
  );

  if (step === 'mapping') return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
        ✓ AI analyzed {analysis.total_rows} rows. Review the column mapping below.
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {Object.keys(mapping).map(field => (
          <div key={field} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <span className="text-xs font-bold text-blue-600 w-36 flex-shrink-0">{field}</span>
            <span className="text-gray-400">→</span>
            <select value={mapping[field] || ''} onChange={e => setMapping(p=>({...p,[field]:e.target.value||null}))}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white">
              <option value="">— not mapped —</option>
              {analysis.headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Btn variant="outline" onClick={() => setStep('upload')}>Back</Btn>
        <Btn onClick={process} disabled={loading}>{loading ? 'Importing...' : `🚀 Import ${analysis.total_rows} Rows`}</Btn>
      </div>
    </div>
  );

  if (step === 'results') return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 font-semibold text-sm">✓ Import complete!</div>
      <div className="grid grid-cols-2 gap-3">
        {[
          ['🏠 New Families', results.created_families, 'text-blue-600'],
          ['👥 New Patients', results.created_patients, 'text-green-600'],
          ['✏️ Updated', results.updated_patients, 'text-yellow-600'],
          ['⚠️ Skipped', results.skipped, 'text-red-500'],
        ].map(([l,v,c]) => (
          <div key={l} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className={`text-2xl font-black ${c}`}>{v}</div>
            <div className="text-xs text-gray-500 mt-1">{l}</div>
          </div>
        ))}
      </div>
      {results.errors?.length > 0 && (
        <div className="bg-red-50 rounded-xl p-3 text-xs text-red-600 space-y-1">
          {results.errors.map((e,i) => <div key={i}>Row {e.row}: {e.error}</div>)}
        </div>
      )}
      <Btn onClick={onClose}>Done</Btn>
    </div>
  );
}

// ── PROFILE PAGE ──────────────────────────────────────────
function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '', theme: user?.theme || 'light', language: user?.language || 'uz' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newLogin: '', newPassword: '' });
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const fileRef = useRef();

  const saveProfile = async () => {
    setSaving(true);
    try { const r = await clientApi.updateProfile(form); updateUser(r.data); toast.success('Saved'); }
    catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const changeCredentials = async () => {
    if (!pwForm.currentPassword) { toast.error('Current password required'); return; }
    try { await clientApi.updateCredentials(pwForm); toast.success('Updated'); setShowPw(false); setPwForm({currentPassword:'',newLogin:'',newPassword:''}); }
    catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const uploadPhoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('photo', f);
    try { const r = await clientApi.updatePhoto(fd); updateUser({ photo_path: r.data.photo_path }); toast.success('Photo updated'); }
    catch { toast.error('Upload failed'); }
  };

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      {/* Avatar */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden shadow-lg">
              {user?.photo_path
                ? <img src={user.photo_path} alt="" className="w-full h-full object-cover" />
                : (user?.name || user?.login || '?')[0].toUpperCase()}
            </div>
            <button onClick={() => fileRef.current.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-600 text-white rounded-full text-xs flex items-center justify-center shadow hover:bg-blue-700 transition">✏️</button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadPhoto} />
          </div>
          <div>
            <p className="font-bold text-xl text-gray-900">{user?.name || user?.login}</p>
            <p className="text-sm text-gray-500">{user?.login}</p>
          </div>
        </div>
      </div>

      {/* Profile form */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
        <h3 className="font-bold text-gray-900">Profile Settings</h3>
        <Input label="Name" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} />
        <Input label="Phone" value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Language" value={form.language} onChange={e=>setForm(p=>({...p,language:e.target.value}))}>
            <option value="uz">🇺🇿 Uzbek</option>
            <option value="ru">🇷🇺 Russian</option>
            <option value="en">🇬🇧 English</option>
          </Select>
          <Select label="Theme" value={form.theme} onChange={e=>setForm(p=>({...p,theme:e.target.value}))}>
            <option value="light">☀️ Light</option>
            <option value="dark">🌙 Dark</option>
          </Select>
        </div>
        <Btn onClick={saveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Btn>
      </div>

      {/* Credentials */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Change Credentials</h3>
          <button onClick={() => setShowPw(p=>!p)} className="text-sm text-blue-600 font-medium">{showPw ? 'Cancel' : 'Update'}</button>
        </div>
        {showPw && (
          <div className="space-y-3">
            <Input label="Current Password" type="password" value={pwForm.currentPassword} onChange={e=>setPwForm(p=>({...p,currentPassword:e.target.value}))} />
            <Input label="New Login (optional)" value={pwForm.newLogin} onChange={e=>setPwForm(p=>({...p,newLogin:e.target.value}))} />
            <Input label="New Password (optional)" type="password" value={pwForm.newPassword} onChange={e=>setPwForm(p=>({...p,newPassword:e.target.value}))} />
            <Btn onClick={changeCredentials}>Update</Btn>
          </div>
        )}
      </div>

      {/* Logout */}
      <button onClick={logout}
        className="w-full py-3.5 rounded-2xl border-2 border-red-200 text-red-500 font-bold hover:bg-red-50 transition">
        Sign Out
      </button>
    </div>
  );
}

// ── MAIN LAYOUT ───────────────────────────────────────────
export default function ClientDashboard() {
  const { user } = useAuth();
  const [page, setPage] = useState('home');

  const navItems = [
    { id: 'home', icon: '📊', label: 'Home' },
    { id: 'families', icon: '🏠', label: 'Families' },
    { id: 'patients', icon: '👥', label: 'Patients' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header */}
      <header className="bg-gray-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-40 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-red-500 rounded-xl flex items-center justify-center text-lg shadow">🏥</div>
          <div>
            <p className="font-black text-base leading-tight">PatronageCare</p>
            <p className="text-xs text-gray-400">Home Visit System</p>
          </div>
        </div>
        <button onClick={() => setPage('profile')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 transition text-sm font-medium">
          {user?.photo_path
            ? <img src={user.photo_path} alt="" className="w-6 h-6 rounded-full object-cover" />
            : <span className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">{(user?.name||user?.login||'?')[0].toUpperCase()}</span>}
          <span className="hidden sm:block">{user?.name || user?.login}</span>
        </button>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-28">
        {page === 'home'     && <HomeDashboard />}
        {page === 'families' && <FamiliesPage />}
        {page === 'patients' && <PatientsPage />}
        {page === 'profile'  && <ProfilePage />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg safe-bottom">
        <div className="flex max-w-4xl mx-auto">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setPage(item.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-all ${
                page === item.id ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}>
              <div className={`p-1.5 rounded-xl transition-all ${page === item.id ? 'bg-blue-50' : ''}`}>
                <span className="text-xl">{item.icon}</span>
              </div>
              <span className="text-xs font-semibold">{item.label}</span>
              {page === item.id && <div className="w-1 h-1 rounded-full bg-blue-600 mt-0.5" />}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
