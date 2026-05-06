import { useState, useEffect, useRef, useCallback } from 'react';
import i18n from '../i18n/index.js';
import { useAuth } from '../hooks/useAuth';
import { dashboardApi } from '../api/dashboard';
import { familiesApi } from '../api/families';
import { patientsApi } from '../api/patients';
import { importApi } from '../api/importApi';
import { clientApi } from '../api/admin';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const RISK_CONFIG = {
  pregnant: { label:'Pregnant',  emoji:'🤰', color:'bg-blue-100 text-blue-700 border-blue-300' },
  child05:  { label:'Child 0–5', emoji:'👶', color:'bg-green-100 text-green-700 border-green-300' },
  chronic:  { label:'Chronic',   emoji:'💊', color:'bg-yellow-100 text-yellow-700 border-yellow-300' },
  disabled: { label:'Disabled',  emoji:'♿', color:'bg-red-100 text-red-700 border-red-300' },
  normal:   { label:'Normal',    emoji:'👤', color:'bg-gray-100 text-gray-600 border-gray-300' },
};

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const isOverdue = (d) => d && new Date(d) < new Date();

function RiskBadge({ cat }) {
  const c = RISK_CONFIG[cat] || RISK_CONFIG.normal;
  return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${c.color}`}>{c.emoji} {c.label}</span>;
}

function StatusBadge({ status }) {
  const m = { pending:'bg-amber-100 text-amber-700 border-amber-300', completed:'bg-green-100 text-green-700 border-green-300', missed:'bg-red-100 text-red-700 border-red-300' };
  return <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold capitalize ${m[status]||'bg-gray-100 text-gray-600 border-gray-200'}`}>{status}</span>;
}

function Spinner() {
  return <div className="flex justify-center items-center py-16"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/></div>;
}

function BackBtn({ onClick, label='← Back' }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 text-indigo-400 hover:text-white text-sm font-semibold py-2 px-1 transition-colors">
      {label}
    </button>
  );
}

function Btn({ children, onClick, variant='primary', sm, type='button', disabled, full, className='' }) {
  const base = `inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl transition-all disabled:opacity-50 select-none ${sm?'px-3 py-1.5 text-xs':'px-4 py-2.5 text-sm'} ${full?'w-full':''} ${className}`;
  const v = {
    primary:'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm active:scale-95',
    outline:'border border-gray-300 text-gray-700 hover:bg-gray-50 bg-white active:scale-95',
    danger:'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 active:scale-95',
    dark:'bg-gray-900 text-white hover:bg-gray-700 active:scale-95',
  };
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${v[variant]||v.primary}`}>{children}</button>;
}

function Field({ label, children }) {
  return <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>{children}</div>;
}
function Inp({ label, ...p }) {
  return <Field label={label}><input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white" {...p}/></Field>;
}
function Sel({ label, children, ...p }) {
  return <Field label={label}><select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white" {...p}>{children}</select></Field>;
}
function Tex({ label, ...p }) {
  return <Field label={label}><textarea className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white" rows={3} {...p}/></Field>;
}

function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}/>
      <div className={`relative bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full ${wide?'sm:max-w-2xl':'sm:max-w-md'} max-h-[92vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-300 text-lg hover:bg-gray-200 transition">×</button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// ── PATIENT FORM ──────────────────────────────────────────
function PatientForm({ initial, familyId, families, onSaved, onClose }) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState({
    family_id: familyId || initial?.family_id || '',
    full_name: initial?.full_name || '', passport: initial?.passport || '',
    birth_date: initial?.birth_date?.split('T')[0] || '',
    blood_group: initial?.blood_group || '', risk_category: initial?.risk_category || 'normal',
    height: initial?.height || '', weight: initial?.weight || '',
    blood_pressure: initial?.blood_pressure || '', notes: initial?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    if (!form.full_name || !form.passport) { toast.error('Name and passport required'); return; }
    setSaving(true);
    try {
      if (isEdit) await patientsApi.update(initial.id, form);
      else await patientsApi.create(form);
      toast.success(isEdit ? 'Updated!' : 'Patient added!');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      {!familyId && (
        <Sel label="Family" value={form.family_id} onChange={set('family_id')}>
          <option value="">— No family —</option>
          {families?.map(f => <option key={f.id} value={f.id}>{f.head_name}</option>)}
        </Sel>
      )}
      <Inp label="Full Name (F.I.SH)" value={form.full_name} onChange={set('full_name')} placeholder="Lastname Firstname Patronymic"/>
      <Inp label="Passport ID" value={form.passport} onChange={set('passport')} placeholder="AA1234567"/>
      <div className="grid grid-cols-2 gap-3">
        <Inp label="Date of Birth" type="date" value={form.birth_date} onChange={set('birth_date')}/>
        <Sel label="Blood Group" value={form.blood_group} onChange={set('blood_group')}>
          {['','A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g=><option key={g} value={g}>{g||'Select'}</option>)}
        </Sel>
      </div>
      <Sel label="Risk Category" value={form.risk_category} onChange={set('risk_category')}>
        {Object.entries(RISK_CONFIG).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}
      </Sel>
      <div className="grid grid-cols-3 gap-2">
        <Inp label="Height cm" type="number" value={form.height} onChange={set('height')} placeholder="165"/>
        <Inp label="Weight kg" type="number" value={form.weight} onChange={set('weight')} placeholder="70"/>
        <Inp label="BP" value={form.blood_pressure} onChange={set('blood_pressure')} placeholder="120/80"/>
      </div>
      <Tex label="Notes" value={form.notes} onChange={set('notes')} placeholder="Additional notes..."/>
      <div className="flex gap-2 pt-1">
        <Btn variant="outline" onClick={onClose} full>Cancel</Btn>
        <Btn onClick={save} disabled={saving} full>{saving?'Saving...':isEdit?'Update':'Save Patient'}</Btn>
      </div>
    </div>
  );
}

// ── PATIENT PAGE ──────────────────────────────────────────
function PatientPage({ patientId, onBack, onDeleted }) {
  const [tab, setTab] = useState('info');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [families, setFamilies] = useState([]);
  const [showVisit, setShowVisit] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showVaccine, setShowVaccine] = useState(false);
  const [showMed, setShowMed] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const [visitForm, setVisitForm] = useState({ visit_date:today, next_visit_date:'', status:'pending' });
  const [histForm, setHistForm] = useState({ visit_date:today, diagnosis:'', medication:'', notes:'' });
  const [vacForm, setVacForm] = useState({ vaccine_name:'', date_given:today, next_date:'' });
  const [medForm, setMedForm] = useState({ medicine_name:'', quantity:'', times_per_day:1, duration_days:1, date_given:today });
  const [imgCaption, setImgCaption] = useState('');
  const fileRef = useRef();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, fam] = await Promise.all([patientsApi.get(patientId), familiesApi.list()]);
      setData(r.data); setFamilies(fam.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const del = async () => {
    if (!confirm('Delete this patient?')) return;
    try { await patientsApi.delete(patientId); toast.success('Deleted'); onDeleted?.(); onBack(); }
    catch { toast.error('Failed'); }
  };

  const uploadImg = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const fd = new FormData(); fd.append('photo', f);
    try {
      const r = await clientApi.updatePhoto(fd);
      await patientsApi.addImage(patientId, { image_url: r.data.photo_path, caption: imgCaption });
      toast.success('Uploaded'); setImgCaption(''); load();
    } catch { toast.error('Upload failed'); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gray-900 px-4 pt-safe pt-4 pb-4">
        <BackBtn onClick={onBack}/>
      </div>
      <Spinner/>
    </div>
  );

  if (!data) return null;
  const { patient, visits=[], history=[], vaccines=[], medications=[], images=[] } = data;

  const tabs = ['info','history','visits','vaccines','meds','images'];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sticky header */}
      <div className="bg-gray-900 text-white px-4 pt-4 pb-4 sticky top-0 z-30 shadow-xl">
        <BackBtn onClick={onBack}/>
        <div className="flex items-start justify-between gap-3 mt-1">
          <div>
            <h1 className="text-xl font-bold leading-tight">{patient.full_name}</h1>
            <p className="text-gray-400 text-xs mt-0.5">
              {patient.passport}{patient.birth_date && ` · ${fmt(patient.birth_date)}`}{patient.blood_group && ` · ${patient.blood_group}`}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {patient.risk_category && patient.risk_category !== 'normal' && <RiskBadge cat={patient.risk_category}/>}
              {visits[0]?.next_visit_date && isOverdue(visits[0].next_visit_date) && visits[0].status !== 'completed' &&
                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-semibold">Visit overdue</span>}
              {vaccines[0]?.next_date && isOverdue(vaccines[0].next_date) &&
                <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-semibold">Vaccine overdue</span>}
            </div>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mt-3 overflow-x-auto pb-0.5 no-scrollbar">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex-shrink-0 capitalize
                ${tab===t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 pb-24 space-y-3 max-w-2xl mx-auto">
        {/* INFO */}
        {tab==='info' && (editMode ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100">
            <PatientForm initial={patient} families={families}
              onSaved={() => { setEditMode(false); load(); }} onClose={() => setEditMode(false)}/>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[['Height', patient.height?`${patient.height} cm`:'—'],
                ['Weight', patient.weight?`${patient.weight} kg`:'—'],
                ['Blood Pressure', patient.blood_pressure||'—'],
                ['Blood Group', patient.blood_group||'—']].map(([l,v])=>(
                <div key={l} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-400 font-medium">{l}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{v}</p>
                </div>
              ))}
            </div>
            {patient.notes && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-gray-700">📝 {patient.notes}</div>
            )}
            <button onClick={()=>setEditMode(true)}
              className="w-full py-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-semibold text-sm hover:bg-gray-50 transition shadow-sm">
              ✏️ Edit Patient Info
            </button>
            <button onClick={del}
              className="w-full flex items-center justify-center gap-2 text-red-500 font-semibold text-sm border border-red-200 rounded-2xl px-4 py-3 hover:bg-red-50 transition">
              🗑️ Delete Patient
            </button>
          </>
        ))}

        {/* HISTORY */}
        {tab==='history' && (
          <>
            {showHistory ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
                <h3 className="font-semibold text-gray-800 dark:text-white">Add Visit Record</h3>
                <Inp label="Date" type="date" value={histForm.visit_date} onChange={e=>setHistForm(p=>({...p,visit_date:e.target.value}))}/>
                <Inp label="Diagnosis" value={histForm.diagnosis} onChange={e=>setHistForm(p=>({...p,diagnosis:e.target.value}))}/>
                <Inp label="Medication" value={histForm.medication} onChange={e=>setHistForm(p=>({...p,medication:e.target.value}))}/>
                <Tex label="Notes" value={histForm.notes} onChange={e=>setHistForm(p=>({...p,notes:e.target.value}))}/>
                <div className="flex gap-2">
                  <Btn variant="outline" onClick={()=>setShowHistory(false)} full>Cancel</Btn>
                  <Btn full onClick={async()=>{await patientsApi.addHistory(patientId,histForm);toast.success('Added');setShowHistory(false);load();}}>Save</Btn>
                </div>
              </div>
            ) : (
              <button onClick={()=>setShowHistory(true)} className="w-full py-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 font-medium text-sm hover:bg-gray-50 transition">
                + Add Visit Record
              </button>
            )}
            {history.map(h=>(
              <div key={h.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 relative">
                <button onClick={async()=>{await patientsApi.deleteHistory(patientId,h.id);load();}} className="absolute top-3 right-3 text-gray-300 hover:text-red-500 text-lg transition">🗑</button>
                <p className="text-xs text-gray-400 font-medium">📅 {fmt(h.visit_date)}</p>
                <p className="font-bold text-gray-900 dark:text-white mt-1">{h.diagnosis||'Visit'}</p>
                {h.medication && <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">💊 {h.medication}</p>}
                {h.notes && <p className="text-sm text-gray-400 italic mt-1">{h.notes}</p>}
              </div>
            ))}
            {!history.length && !showHistory && <div className="text-center py-12 text-gray-400 text-sm">No history records yet</div>}
          </>
        )}

        {/* VISITS */}
        {tab==='visits' && (
          <>
            {showVisit ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
                <h3 className="font-semibold text-gray-800 dark:text-white">Add Visit</h3>
                <Inp label="Visit Date" type="date" value={visitForm.visit_date} onChange={e=>setVisitForm(p=>({...p,visit_date:e.target.value}))}/>
                <Inp label="Next Visit Date" type="date" value={visitForm.next_visit_date} onChange={e=>setVisitForm(p=>({...p,next_visit_date:e.target.value}))}/>
                <Sel label="Status" value={visitForm.status} onChange={e=>setVisitForm(p=>({...p,status:e.target.value}))}>
                  <option value="pending">⏳ Pending</option>
                  <option value="completed">✅ Completed</option>
                  <option value="missed">⚠️ Missed</option>
                </Sel>
                <div className="flex gap-2">
                  <Btn variant="outline" onClick={()=>setShowVisit(false)} full>Cancel</Btn>
                  <Btn full onClick={async()=>{await patientsApi.addVisit(patientId,visitForm);toast.success('Added');setShowVisit(false);load();}}>Save</Btn>
                </div>
              </div>
            ) : (
              <button onClick={()=>setShowVisit(true)} className="w-full py-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 font-medium text-sm hover:bg-gray-50 transition">
                + Add Visit
              </button>
            )}
            {visits.map(v=>(
              <div key={v.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">📅 {fmt(v.visit_date)}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5 flex items-center gap-2">
                    Next: {fmt(v.next_visit_date)}
                    {isOverdue(v.next_visit_date) && v.status!=='completed' && <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200 text-xs">overdue</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={v.status}/>
                  <button onClick={async()=>{await patientsApi.deleteVisit(patientId,v.id);load();}} className="text-gray-300 hover:text-red-500 transition text-lg">🗑</button>
                </div>
              </div>
            ))}
            {!visits.length && !showVisit && <div className="text-center py-12 text-gray-400 text-sm">No visits yet</div>}
          </>
        )}

        {/* VACCINES */}
        {tab==='vaccines' && (
          <>
            {showVaccine ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
                <h3 className="font-semibold text-gray-800 dark:text-white">Add Vaccination</h3>
                <Inp label="Vaccine Name" value={vacForm.vaccine_name} onChange={e=>setVacForm(p=>({...p,vaccine_name:e.target.value}))} placeholder="BCG, DTP, COVID-19..."/>
                <div className="grid grid-cols-2 gap-3">
                  <Inp label="Date Given" type="date" value={vacForm.date_given} onChange={e=>setVacForm(p=>({...p,date_given:e.target.value}))}/>
                  <Inp label="Next Date" type="date" value={vacForm.next_date} onChange={e=>setVacForm(p=>({...p,next_date:e.target.value}))}/>
                </div>
                <div className="flex gap-2">
                  <Btn variant="outline" onClick={()=>setShowVaccine(false)} full>Cancel</Btn>
                  <Btn full onClick={async()=>{
                    if(!vacForm.vaccine_name){toast.error('Name required');return;}
                    await patientsApi.addVaccine(patientId,vacForm);toast.success('Added');setShowVaccine(false);load();
                  }}>Save</Btn>
                </div>
              </div>
            ) : (
              <button onClick={()=>setShowVaccine(true)} className="w-full py-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 font-medium text-sm hover:bg-gray-50 transition">
                + Add Vaccination
              </button>
            )}
            {vaccines.map(v=>(
              <div key={v.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">💉 {v.vaccine_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Given: {fmt(v.date_given)}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1.5">
                    Next: {fmt(v.next_date)}
                    {isOverdue(v.next_date) && <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200 text-xs">overdue</span>}
                  </p>
                </div>
                <button onClick={async()=>{await patientsApi.deleteVaccine(patientId,v.id);load();}} className="text-gray-300 hover:text-red-500 transition text-lg">🗑</button>
              </div>
            ))}
            {!vaccines.length && !showVaccine && <div className="text-center py-12 text-gray-400 text-sm">No vaccines recorded</div>}
          </>
        )}

        {/* MEDS */}
        {tab==='meds' && (
          <>
            {showMed ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
                <h3 className="font-semibold text-gray-800 dark:text-white">Add Medication</h3>
                <Inp label="Medicine Name" value={medForm.medicine_name} onChange={e=>setMedForm(p=>({...p,medicine_name:e.target.value}))}/>
                <div className="grid grid-cols-3 gap-2">
                  <Inp label="Quantity" value={medForm.quantity} onChange={e=>setMedForm(p=>({...p,quantity:e.target.value}))} placeholder="60 tabs"/>
                  <Inp label="Times/day" type="number" min="1" value={medForm.times_per_day} onChange={e=>setMedForm(p=>({...p,times_per_day:e.target.value}))}/>
                  <Inp label="Days" type="number" min="1" value={medForm.duration_days} onChange={e=>setMedForm(p=>({...p,duration_days:e.target.value}))}/>
                </div>
                <Inp label="Date Given" type="date" value={medForm.date_given} onChange={e=>setMedForm(p=>({...p,date_given:e.target.value}))}/>
                <div className="flex gap-2">
                  <Btn variant="outline" onClick={()=>setShowMed(false)} full>Cancel</Btn>
                  <Btn full onClick={async()=>{
                    if(!medForm.medicine_name){toast.error('Name required');return;}
                    await patientsApi.addMedication(patientId,medForm);toast.success('Added');setShowMed(false);load();
                  }}>Save</Btn>
                </div>
              </div>
            ) : (
              <button onClick={()=>setShowMed(true)} className="w-full py-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 font-medium text-sm hover:bg-gray-50 transition">
                + Add Medication
              </button>
            )}
            {medications.map(m=>(
              <div key={m.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">💊 {m.medicine_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.quantity&&`${m.quantity} · `}{m.times_per_day}x/day · {m.duration_days} days · {fmt(m.date_given)}</p>
                </div>
                <button onClick={async()=>{await patientsApi.deleteMedication(patientId,m.id);load();}} className="text-gray-300 hover:text-red-500 transition text-lg">🗑</button>
              </div>
            ))}
            {!medications.length && !showMed && <div className="text-center py-12 text-gray-400 text-sm">No medications</div>}
          </>
        )}

        {/* IMAGES */}
        {tab==='images' && (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
              <Inp label="Caption (optional)" value={imgCaption} onChange={e=>setImgCaption(e.target.value)} placeholder="e.g. Wound progress"/>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadImg}/>
              <button onClick={()=>fileRef.current.click()} className="w-full py-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 font-medium text-sm transition border border-gray-200">
                📷 Upload Image
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {images.map(img=>(
                <div key={img.id} className="relative rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white">
                  <img src={img.image_url} alt={img.caption} className="w-full h-36 object-cover"/>
                  {img.caption && <p className="text-xs text-gray-600 p-2">{img.caption}</p>}
                  <button onClick={async()=>{await patientsApi.deleteImage(patientId,img.id);load();}} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">×</button>
                </div>
              ))}
            </div>
            {!images.length && <div className="text-center py-12 text-gray-400 text-sm">No images</div>}
          </>
        )}
      </div>
    </div>
  );
}

// ── FAMILY PAGE ───────────────────────────────────────────
function FamilyPage({ familyId, onBack, onPatientSelect }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [editForm, setEditForm] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await familiesApi.get(familyId); setData(r.data); setEditForm(r.data.family); }
    catch { toast.error('Failed'); }
    finally { setLoading(false); }
  }, [familyId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gray-900 px-4 pt-4 pb-4"><BackBtn onClick={onBack} label="← Back to Families"/></div>
      <Spinner/>
    </div>
  );

  if (!data) return null;
  const { family, members=[] } = data;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gray-900 text-white sticky top-0 z-30 shadow-xl">
        <div className="px-4 pt-4 pb-5">
          <BackBtn onClick={onBack} label="← Back to Families"/>
          <div className="flex items-start justify-between mt-2">
            <div>
              <h1 className="text-xl font-bold">🏠 {family.head_name}</h1>
              <div className="mt-1 space-y-0.5">
                {family.address && <p className="text-gray-400 text-sm flex items-center gap-1.5"><span>📍</span>{family.address}</p>}
                {family.phone && <p className="text-gray-400 text-sm flex items-center gap-1.5"><span>📞</span>{family.phone}</p>}
              </div>
            </div>
            <div className="flex gap-2 mt-1">
              <button onClick={()=>setShowEdit(p=>!p)}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition text-lg font-bold">✏️</button>
              <button onClick={async()=>{if(!confirm('Delete family?'))return;await familiesApi.delete(familyId);toast.success('Deleted');onBack();}}
                className="w-10 h-10 rounded-xl bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition text-lg">🗑️</button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 pb-24 max-w-2xl mx-auto space-y-4">
        {/* Edit form */}
        {showEdit && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
            <h3 className="font-semibold text-gray-800 dark:text-white">Edit Family</h3>
            <Inp label="Head of Family" value={editForm.head_name||''} onChange={e=>setEditForm(p=>({...p,head_name:e.target.value}))}/>
            <Inp label="Address" value={editForm.address||''} onChange={e=>setEditForm(p=>({...p,address:e.target.value}))}/>
            <Inp label="Phone" value={editForm.phone||''} onChange={e=>setEditForm(p=>({...p,phone:e.target.value}))}/>
            <div className="flex gap-2">
              <Btn variant="outline" onClick={()=>setShowEdit(false)} full>Cancel</Btn>
              <Btn full onClick={async()=>{await familiesApi.update(familyId,editForm);toast.success('Updated');setShowEdit(false);load();}}>Save</Btn>
            </div>
          </div>
        )}

        {/* Members */}
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900 dark:text-white text-lg">Members ({members.length})</h2>
          <Btn sm onClick={()=>setShowAddMember(p=>!p)}>{showAddMember?'Cancel':'+ Add Member'}</Btn>
        </div>

        {showAddMember && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-3">Add Member</h3>
            <PatientForm familyId={familyId} onSaved={()=>{setShowAddMember(false);load();}} onClose={()=>setShowAddMember(false)}/>
          </div>
        )}

        {members.length===0 && !showAddMember && (
          <div className="text-center py-12 text-gray-400"><div className="text-4xl mb-2">👥</div><p className="text-sm">No members yet</p></div>
        )}

        <div className="space-y-2">
          {members.map(m=>(
            <div key={m.id} onClick={()=>onPatientSelect(m.id)}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-indigo-200 hover:shadow-md transition active:scale-98">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-bold text-gray-900 dark:text-white">{m.full_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">DOB: {fmt(m.birth_date)} · {m.passport}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {m.risk_category && m.risk_category!=='normal' && <RiskBadge cat={m.risk_category}/>}
                    {isOverdue(m.next_visit) && <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200 text-xs font-semibold">Visit overdue</span>}
                    {isOverdue(m.next_vaccine) && <span className="px-2 py-0.5 rounded-full bg-orange-50 text-orange-500 border border-orange-200 text-xs font-semibold">Vaccine overdue</span>}
                  </div>
                </div>
                <span className="text-gray-400 text-xl flex-shrink-0">›</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── HOME ──────────────────────────────────────────────────
function HomeDashboard({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.getStats().then(r=>setStats(r.data)).catch(()=>toast.error('Failed')).finally(()=>setLoading(false));
  }, []);

  if (loading) return <Spinner/>;
  if (!stats) return null;

  const cards = [
    { icon:'👥', val:stats.total_patients, label:'Total Patients', color:'text-indigo-600', page:'patients' },
    { icon:'⚠️', val:stats.missed_visits, label:'Missed Visits', color:'text-red-500', page:'patients', filter:'missed' },
    { icon:'💉', val:stats.upcoming_vaccines, label:'Upcoming Vaccines', color:'text-amber-500', page:'vaccines' },
    { icon:'🏠', val:stats.total_families, label:'Families', color:'text-emerald-600', page:'families' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {cards.map(c=>(
          <button key={c.label} onClick={()=>onNavigate(c.page,c.filter)}
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 text-left hover:border-indigo-200 hover:shadow-md transition active:scale-95">
            <div className="text-3xl mb-2">{c.icon}</div>
            <div className={`text-3xl font-black ${c.color}`}>{c.val}</div>
            <div className="text-xs text-gray-500 mt-1 font-medium">{c.label}</div>
          </button>
        ))}
      </div>

      {stats.risk_groups?.length>0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">Risk Groups</h3>
          <div className="space-y-2">
            {stats.risk_groups.map(rg=>{
              const cfg = RISK_CONFIG[rg.risk_category]||RISK_CONFIG.normal;
              return (
                <button key={rg.risk_category} onClick={()=>onNavigate('patients',rg.risk_category)}
                  className={`flex items-center justify-between w-full p-3 rounded-xl border ${cfg.color} hover:opacity-80 transition active:scale-95`}>
                  <span className="font-semibold text-sm">{cfg.emoji} {cfg.label}</span>
                  <span className="font-bold">{rg.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {stats.reminders?.length>0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">Reminders</h3>
          <div className="space-y-2">
            {stats.reminders.map((r,i)=>(
              <div key={i} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800">
                <div>
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">{r.full_name}</p>
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

// ── FAMILIES LIST ─────────────────────────────────────────
function FamiliesList({ onFamilySelect }) {
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ head_name:'', address:'', phone:'' });

  const load = () => familiesApi.list().then(r=>setFamilies(r.data)).catch(()=>toast.error('Failed')).finally(()=>setLoading(false));
  useEffect(()=>{ load(); },[]);

  const add = async () => {
    if (!addForm.head_name) { toast.error('Name required'); return; }
    try { await familiesApi.create(addForm); toast.success('Added!'); setShowAdd(false); setAddForm({head_name:'',address:'',phone:''}); load(); }
    catch { toast.error('Failed'); }
  };

  if (loading) return <Spinner/>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white">Families</h2>
        <Btn onClick={()=>setShowAdd(true)}>+ Add</Btn>
      </div>
      <Modal open={showAdd} onClose={()=>setShowAdd(false)} title="Add Family">
        <div className="space-y-3">
          <Inp label="Head of Family" value={addForm.head_name} onChange={e=>setAddForm(p=>({...p,head_name:e.target.value}))} placeholder="Full name"/>
          <Inp label="Address" value={addForm.address} onChange={e=>setAddForm(p=>({...p,address:e.target.value}))} placeholder="Street, district"/>
          <Inp label="Phone" value={addForm.phone} onChange={e=>setAddForm(p=>({...p,phone:e.target.value}))} placeholder="+998..."/>
          <div className="flex gap-2"><Btn variant="outline" onClick={()=>setShowAdd(false)} full>Cancel</Btn><Btn onClick={add} full>Save</Btn></div>
        </div>
      </Modal>
      {families.length===0 ? (
        <div className="text-center py-16 text-gray-400"><div className="text-5xl mb-3">🏠</div><p className="text-sm font-medium">No families yet</p></div>
      ) : (
        <div className="space-y-3">
          {families.map(f=>(
            <div key={f.id} onClick={()=>onFamilySelect(f.id)}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-indigo-200 hover:shadow-md transition active:scale-98">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">🏠 {f.head_name}</p>
                  {f.address && <p className="text-sm text-gray-500 mt-0.5">📍 {f.address}</p>}
                  {f.phone && <p className="text-sm text-gray-500">📞 {f.phone}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {f.risk_categories?.filter(Boolean).map(r=><RiskBadge key={r} cat={r}/>)}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-indigo-600 font-bold text-xl">{f.member_count}</span>
                  <p className="text-xs text-gray-400">members</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PATIENTS LIST ─────────────────────────────────────────
function PatientsList({ initialRisk, initialVisit, onPatientSelect }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [risk, setRisk] = useState(initialRisk||'all');
  const [visitStatus, setVisitStatus] = useState(initialVisit||'all');
  const [families, setFamilies] = useState([]);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (risk!=='all') params.risk = risk;
      if (visitStatus!=='all') params.visit_status = visitStatus;
      const r = await patientsApi.list(params);
      setPatients(r.data);
    } catch { toast.error('Failed'); }
    finally { setLoading(false); }
  }, [search, risk, visitStatus]);

  useEffect(()=>{ load(); },[load]);
  useEffect(()=>{ familiesApi.list().then(r=>setFamilies(r.data)).catch(()=>{}); },[]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white">Patients</h2>
        <Btn sm onClick={()=>setShowAdd(true)}>+ Add</Btn>
      </div>
      <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-2xl px-4 py-3 shadow-sm">
        <span className="text-gray-400">🔍</span>
        <input className="flex-1 text-sm outline-none bg-transparent dark:text-white" placeholder="Search by name or passport..."
          value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      <div className="flex gap-2 flex-wrap">
        <select value={risk} onChange={e=>setRisk(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="all">All Risk</option>
          {Object.entries(RISK_CONFIG).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}
        </select>
        <select value={visitStatus} onChange={e=>setVisitStatus(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="all">All Visits</option>
          <option value="pending">⏳ Pending</option>
          <option value="completed">✅ Completed</option>
          <option value="missed">⚠️ Missed</option>
        </select>
      </div>
      <p className="text-xs text-gray-500">{patients.length} patient{patients.length!==1?'s':''} found</p>

      <Modal open={showAdd} onClose={()=>setShowAdd(false)} title="Add Patient" wide>
        <PatientForm families={families} onSaved={()=>{setShowAdd(false);load();}} onClose={()=>setShowAdd(false)}/>
      </Modal>

      {loading ? <Spinner/> : patients.length===0 ? (
        <div className="text-center py-16 text-gray-400"><div className="text-5xl mb-3">👥</div><p className="text-sm font-medium">No patients found</p></div>
      ) : (
        <div className="space-y-2">
          {patients.map(p=>(
            <div key={p.id} onClick={()=>onPatientSelect(p.id)}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-indigo-200 hover:shadow-md transition active:scale-98">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900 dark:text-white">{p.full_name}</p>
                    {p.risk_category&&p.risk_category!=='normal'&&<RiskBadge cat={p.risk_category}/>}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">DOB: {fmt(p.birth_date)}{p.blood_group&&` · ${p.blood_group}`}</p>
                  {p.family_name&&<p className="text-xs text-gray-400 mt-0.5">🏠 {p.family_name}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.last_visit_status&&<StatusBadge status={p.last_visit_status}/>}
                    {p.next_visit_date&&isOverdue(p.next_visit_date)&&p.last_visit_status!=='completed'&&
                      <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200 text-xs font-semibold">Visit overdue</span>}
                  </div>
                </div>
                <span className="text-gray-400 flex-shrink-0 text-xl">›</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── VACCINES PAGE ─────────────────────────────────────────
function VaccinesPage({ onPatientSelect, onBack }) {
  const [vaccines, setVaccines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    patientsApi.list({}).then(async r=>{
      const all = [];
      for (const p of r.data) {
        try { const vr = await patientsApi.getVaccines(p.id); vr.data.forEach(v=>all.push({...v,patient_name:p.full_name,patient_id:p.id})); } catch {}
      }
      all.sort((a,b)=>new Date(a.next_date||'9999')-new Date(b.next_date||'9999'));
      setVaccines(all);
    }).catch(()=>toast.error('Failed')).finally(()=>setLoading(false));
  },[]);

  if (loading) return <Spinner/>;

  const overdue = vaccines.filter(v=>isOverdue(v.next_date));
  const upcoming = vaccines.filter(v=>v.next_date&&!isOverdue(v.next_date));
  const noDate = vaccines.filter(v=>!v.next_date);

  const VCard = ({v}) => (
    <div onClick={()=>onPatientSelect(v.patient_id)}
      className="flex items-center justify-between p-3 rounded-xl border cursor-pointer hover:opacity-80 transition active:scale-95 bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700">
      <div>
        <p className="font-semibold text-gray-900 dark:text-white text-sm">💉 {v.vaccine_name}</p>
        <p className="text-xs text-gray-500">{v.patient_name}</p>
        <p className="text-xs text-gray-400">Given: {fmt(v.date_given)}{v.next_date&&` · Next: ${fmt(v.next_date)}`}</p>
      </div>
      {isOverdue(v.next_date)&&<span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">Overdue</span>}
    </div>
  );

  return (
    <div className="space-y-4">
      {onBack&&<BackBtn onClick={onBack} label="← Back"/>}
      <h2 className="text-2xl font-black text-gray-900 dark:text-white">Vaccines</h2>
      {vaccines.length===0&&<div className="text-center py-16 text-gray-400"><div className="text-5xl mb-3">💉</div><p className="text-sm">No vaccines recorded</p></div>}
      {overdue.length>0&&(
        <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 border border-red-100 dark:border-red-800">
          <h3 className="font-bold text-red-600 mb-3 text-sm uppercase">⚠️ Overdue ({overdue.length})</h3>
          <div className="space-y-2">{overdue.map(v=><VCard key={v.id} v={v}/>)}</div>
        </div>
      )}
      {upcoming.length>0&&(
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3 text-sm uppercase">📅 Upcoming ({upcoming.length})</h3>
          <div className="space-y-2">{upcoming.map(v=><VCard key={v.id} v={v}/>)}</div>
        </div>
      )}
      {noDate.length>0&&(
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3 text-sm uppercase">✅ Given ({noDate.length})</h3>
          <div className="space-y-2">{noDate.map(v=><VCard key={v.id} v={v}/>)}</div>
        </div>
      )}
    </div>
  );
}

// ── EXPORT PAGE ───────────────────────────────────────────
function ExportPage({ onBack }) {
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [risk, setRisk] = useState('all');
  const [format, setFormat] = useState('xlsx');

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (risk!=='all') params.risk = risk;
      const r = await patientsApi.list(params);
      setPatients(r.data);
    } catch { toast.error('Failed'); }
    finally { setLoading(false); }
  },[search,risk]);

  useEffect(()=>{ load(); },[load]);

  const toggle = (id)=>setSelected(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const toggleAll = ()=>setSelected(selected.length===patients.length?[]:patients.map(p=>p.id));

  const doExport = ()=>{
    const toExport = selected.length>0 ? patients.filter(p=>selected.includes(p.id)) : patients;
    const rows = toExport.map(p=>({
      'Full Name':p.full_name,'Passport':p.passport,'Date of Birth':p.birth_date,
      'Blood Group':p.blood_group,'Risk':p.risk_category,'Family':p.family_name||'',
      'Height':p.height,'Weight':p.weight,'BP':p.blood_pressure,'Notes':p.notes,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Patients');
    XLSX.writeFile(wb,`patients_${new Date().toISOString().split('T')[0]}.${format}`);
    toast.success(`Exported ${toExport.length} patients!`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm">← Back</button>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white">Export</h2>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Format</p>
        <div className="flex gap-2">
          {[['xlsx','📊 Excel'],['csv','📄 CSV']].map(([val,label])=>(
            <button key={val} onClick={()=>setFormat(val)}
              className={`flex-1 p-3 rounded-xl border-2 text-sm font-semibold transition ${format===val?'border-indigo-500 bg-indigo-50 text-indigo-700':'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Filter</p>
        <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5">
          <span className="text-gray-400">🔍</span>
          <input className="flex-1 text-sm outline-none bg-transparent dark:text-white" placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select value={risk} onChange={e=>setRisk(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white">
          <option value="all">All Risk Categories</option>
          {Object.entries(RISK_CONFIG).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}
        </select>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={selected.length===patients.length&&patients.length>0} onChange={toggleAll} className="w-4 h-4 accent-indigo-600"/>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Select All ({patients.length})</span>
          </label>
          <span className="text-xs text-gray-400">{selected.length>0?`${selected.length} selected`:'All will export'}</span>
        </div>
        {loading?<Spinner/>:(
          <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {patients.map(p=>(
              <label key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition">
                <input type="checkbox" checked={selected.includes(p.id)} onChange={()=>toggle(p.id)} className="w-4 h-4 accent-indigo-600 flex-shrink-0"/>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 truncate">{p.full_name}</p>
                  <p className="text-xs text-gray-400">{p.passport}</p>
                </div>
                {p.risk_category&&p.risk_category!=='normal'&&<RiskBadge cat={p.risk_category}/>}
              </label>
            ))}
          </div>
        )}
      </div>
      <Btn onClick={doExport} full className="py-4 text-base">📤 Export {selected.length>0?selected.length:patients.length} Patients</Btn>
    </div>
  );
}

// ── IMPORT PAGE ───────────────────────────────────────────
function ImportPage({ onBack, onDone }) {
  const [step, setStep] = useState('upload');
  const [analysis, setAnalysis] = useState(null);
  const [mapping, setMapping] = useState({});
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const fileRef = useRef();

  const FIELDS = {
    family_head:'Family Head Name', family_address:'Family Address', family_phone:'Family Phone',
    full_name:'Patient Full Name', passport:'Passport ID', birth_date:'Date of Birth',
    blood_group:'Blood Group', risk_category:'Risk Category',
    height:'Height (cm)', weight:'Weight (kg)', blood_pressure:'Blood Pressure', notes:'Notes',
  };

  const analyze = async(f)=>{
    setLoading(true);
    const fd = new FormData(); fd.append('file',f);
    try { const r = await importApi.analyze(fd); setAnalysis(r.data); setMapping(r.data.mapping||{}); setStep('mapping'); }
    catch { toast.error('Analysis failed'); }
    finally { setLoading(false); }
  };

  const process = async()=>{
    setLoading(true);
    const fd = new FormData(); fd.append('file',file); fd.append('mapping',JSON.stringify(mapping));
    try { const r = await importApi.process(fd); setResults(r.data.results); setStep('results'); }
    catch { toast.error('Import failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm">← Back</button>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white">Import</h2>
      </div>

      {step==='upload' && (
        <>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl p-4 text-sm text-blue-700 dark:text-blue-300">
            <p className="font-semibold mb-1">📋 Excel file format:</p>
            <ul className="space-y-0.5 text-xs">
              <li>• Columns can be in any order</li>
              <li>• Required: Full Name, Passport ID</li>
              <li>• Optional: Family, DOB, Blood Group, Risk, Height, Weight</li>
              <li>• Formats: .xlsx · .xls · .csv</li>
            </ul>
          </div>
          <div onClick={()=>fileRef.current.click()}
            className="border-2 border-dashed border-indigo-300 rounded-2xl p-12 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition">
            <div className="text-5xl mb-3">📊</div>
            <p className="font-bold text-gray-700">Tap to select file</p>
            <p className="text-sm text-gray-400 mt-1">.xlsx · .xls · .csv</p>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e=>{const f=e.target.files?.[0];if(f){setFile(f);analyze(f);}}}/>
          {loading&&<div className="text-center py-4"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"/><p className="text-sm text-indigo-600">Analyzing...</p></div>}
        </>
      )}

      {step==='mapping'&&analysis&&(
        <>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-3 text-sm text-green-700">✓ {analysis.total_rows} rows found. Review mapping:</div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {Object.entries(FIELDS).map(([field,label])=>(
                <div key={field} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-xs font-bold text-indigo-600 w-28 flex-shrink-0 leading-tight">{label}</span>
                  <span className="text-gray-300">→</span>
                  <select value={mapping[field]||''} onChange={e=>setMapping(p=>({...p,[field]:e.target.value||null}))}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-400">
                    <option value="">— not mapped —</option>
                    {analysis.headers?.map(h=><option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Btn variant="outline" onClick={()=>setStep('upload')} full>Back</Btn>
            <Btn onClick={process} disabled={loading} full>{loading?'Importing...':'🚀 Import Now'}</Btn>
          </div>
        </>
      )}

      {step==='results'&&results&&(
        <>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-3 text-green-700 font-semibold text-sm">✓ Import complete!</div>
          <div className="grid grid-cols-2 gap-3">
            {[['🏠 Families',results.created_families,'text-indigo-600'],['👥 New Patients',results.created_patients,'text-green-600'],['✏️ Updated',results.updated_patients,'text-amber-600'],['⚠️ Skipped',results.skipped,'text-red-500']].map(([l,v,c])=>(
              <div key={l} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className={`text-2xl font-black ${c}`}>{v}</div>
                <div className="text-xs text-gray-500 mt-1">{l}</div>
              </div>
            ))}
          </div>
          {results.errors?.length>0&&<div className="bg-red-50 rounded-2xl p-3 border border-red-100 space-y-1">{results.errors.map((e,i)=><div key={i} className="text-xs text-red-600">Row {e.row}: {e.error}</div>)}</div>}
          <Btn onClick={onDone} full>Done</Btn>
        </>
      )}
    </div>
  );
}

// ── PROFILE PAGE ──────────────────────────────────────────
function ProfilePage({ onExport, onImport, onBack }) {
  const { user, logout, updateUser } = useAuth();
  const [form, setForm] = useState({ name:user?.name||'', phone:user?.phone||'', theme:user?.theme||'light', language:user?.language||'uz' });
  const [pwForm, setPwForm] = useState({ currentPassword:'', newLogin:'', newPassword:'' });
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const fileRef = useRef();

  const save = async()=>{
    setSaving(true);
    try {
      const r = await clientApi.updateProfile(form);
      updateUser(r.data);
      // Apply theme immediately
      if (form.theme==='dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      // Apply language immediately
      i18n.changeLanguage(form.language);
      toast.success('Saved!');
    }
    catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const changeCred = async()=>{
    if (!pwForm.currentPassword) { toast.error('Current password required'); return; }
    try { await clientApi.updateCredentials(pwForm); toast.success('Updated!'); setShowPw(false); setPwForm({currentPassword:'',newLogin:'',newPassword:''}); }
    catch(err) { toast.error(err.response?.data?.message||'Failed'); }
  };

  const uploadPhoto = async(e)=>{
    const f = e.target.files?.[0]; if (!f) return;
    const fd = new FormData(); fd.append('photo',f);
    try { const r = await clientApi.updatePhoto(fd); updateUser({photo_path:r.data.photo_path}); toast.success('Photo updated!'); }
    catch { toast.error('Upload failed'); }
  };

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {onBack&&<BackBtn onClick={onBack} label="← Back"/>}
      {/* Avatar */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden shadow-lg">
              {user?.photo_path?<img src={user.photo_path} alt="" className="w-full h-full object-cover"/>:(user?.name||user?.login||'?')[0].toUpperCase()}
            </div>
            <button onClick={()=>fileRef.current.click()} className="absolute -bottom-1 -right-1 w-7 h-7 bg-indigo-600 text-white rounded-full text-xs flex items-center justify-center shadow hover:bg-indigo-700 transition">✏️</button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadPhoto}/>
          </div>
          <div>
            <p className="font-bold text-xl text-gray-900 dark:text-white">{user?.name||user?.login}</p>
            <p className="text-sm text-gray-500">{user?.login}</p>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        <h3 className="font-bold text-gray-900 dark:text-white">Settings</h3>
        <Inp label="Name" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/>
        <Inp label="Phone" value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))}/>
        <div className="grid grid-cols-2 gap-3">
          <Sel label="Language" value={form.language} onChange={e=>setForm(p=>({...p,language:e.target.value}))}>
            <option value="uz">🇺🇿 Uzbek</option>
            <option value="ru">🇷🇺 Russian</option>
            <option value="en">🇬🇧 English</option>
          </Sel>
          <Sel label="Theme" value={form.theme} onChange={e=>{
            setForm(p=>({...p,theme:e.target.value}));
            // Preview immediately
            if (e.target.value==='dark') document.documentElement.classList.add('dark');
            else document.documentElement.classList.remove('dark');
          }}>
            <option value="light">☀️ Light</option>
            <option value="dark">🌙 Dark</option>
          </Sel>
        </div>
        <Btn onClick={save} disabled={saving} full>{saving?'Saving...':'Save Changes'}</Btn>
      </div>

      {/* Credentials */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-900 dark:text-white">Credentials</h3>
          <button onClick={()=>setShowPw(p=>!p)} className="text-sm text-indigo-600 font-medium">{showPw?'Cancel':'Change'}</button>
        </div>
        {showPw&&(
          <div className="space-y-3">
            <Inp label="Current Password" type="password" value={pwForm.currentPassword} onChange={e=>setPwForm(p=>({...p,currentPassword:e.target.value}))}/>
            <Inp label="New Login (optional)" value={pwForm.newLogin} onChange={e=>setPwForm(p=>({...p,newLogin:e.target.value}))}/>
            <Inp label="New Password (optional)" type="password" value={pwForm.newPassword} onChange={e=>setPwForm(p=>({...p,newPassword:e.target.value}))}/>
            <Btn onClick={changeCred} full>Update</Btn>
          </div>
        )}
      </div>

      {/* Export/Import */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={onExport} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-center hover:border-green-300 transition active:scale-95">
          <div className="text-2xl mb-1">📤</div>
          <p className="font-semibold text-sm text-gray-700 dark:text-gray-200">Export</p>
          <p className="text-xs text-gray-400">Excel / CSV</p>
        </button>
        <button onClick={onImport} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-center hover:border-blue-300 transition active:scale-95">
          <div className="text-2xl mb-1">📥</div>
          <p className="font-semibold text-sm text-gray-700 dark:text-gray-200">Import</p>
          <p className="text-xs text-gray-400">From Excel</p>
        </button>
      </div>

      <button onClick={logout} className="w-full py-4 rounded-2xl border-2 border-red-200 text-red-500 font-bold hover:bg-red-50 transition text-sm active:scale-95">
        Sign Out
      </button>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────
export default function ClientDashboard() {
  const { user } = useAuth();
  const [page, setPage] = useState('home');
  const [selectedFamilyId, setSelectedFamilyId] = useState(null);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [prevPage, setPrevPage] = useState('families');
  const [pFilter, setPFilter] = useState({ risk:'all', visit:'all' });

  const navItems = [
    { id:'home', icon:'📊', label:'Home' },
    { id:'families', icon:'🏠', label:'Families' },
    { id:'patients', icon:'👥', label:'Patients' },
  ];

  const navigate = (pg, filter) => {
    if (pg==='patients'&&filter) {
      if (filter==='missed') setPFilter({ risk:'all', visit:'missed' });
      else setPFilter({ risk:filter, visit:'all' });
    }
    setPage(pg);
  };

  const openFamily = (id) => { setSelectedFamilyId(id); setPage('family-detail'); };
  const openPatient = (id, from) => { setSelectedPatientId(id); setPrevPage(from||page); setPage('patient-detail'); };

  // Full screen pages (no bottom nav)
  if (page==='patient-detail'&&selectedPatientId) {
    return <PatientPage
      patientId={selectedPatientId}
      onBack={()=>setPage(prevPage==='family-detail'?'family-detail':'patients')}
      onDeleted={()=>{ if(prevPage==='family-detail') setPage('family-detail'); else setPage('patients'); }}
    />;
  }
  if (page==='family-detail'&&selectedFamilyId) {
    return <FamilyPage familyId={selectedFamilyId} onBack={()=>setPage('families')} onPatientSelect={(id)=>openPatient(id,'family-detail')}/>;
  }
  if (page==='export') return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6 pb-8 max-w-2xl mx-auto"><ExportPage onBack={()=>setPage('profile')}/></div>;
  if (page==='import') return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6 pb-8 max-w-2xl mx-auto"><ImportPage onBack={()=>setPage('profile')} onDone={()=>setPage('patients')}/></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-gray-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-40 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-red-500 rounded-xl flex items-center justify-center text-lg shadow font-bold select-none">🏥</div>
          <div>
            <p className="font-black text-base leading-tight">PatronageCare</p>
            <p className="text-xs text-gray-400">Home Visit System</p>
          </div>
        </div>
        <button onClick={()=>setPage('profile')} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 transition text-sm font-medium active:scale-95">
          <span className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0">
            {user?.photo_path?<img src={user.photo_path} alt="" className="w-full h-full object-cover"/>:(user?.name||user?.login||'?')[0].toUpperCase()}
          </span>
          <span className="hidden sm:block max-w-28 truncate">{user?.name||user?.login}</span>
        </button>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-5 pb-28">
        {page==='home'     && <HomeDashboard onNavigate={navigate}/>}
        {page==='families' && <FamiliesList onFamilySelect={openFamily}/>}
        {page==='patients' && <PatientsList initialRisk={pFilter.risk} initialVisit={pFilter.visit} onPatientSelect={(id)=>openPatient(id,'patients')}/>}
        {page==='vaccines' && <VaccinesPage onPatientSelect={(id)=>openPatient(id,'vaccines')} onBack={()=>setPage('home')}/>}
        {page==='profile'  && <ProfilePage onExport={()=>setPage('export')} onImport={()=>setPage('import')} onBack={()=>setPage('home')}/>}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-2xl">
        <div className="flex max-w-2xl mx-auto">
          {navItems.map(item=>(
            <button key={item.id} onClick={()=>navigate(item.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-3 transition-all select-none active:scale-95
                ${page===item.id||( item.id==='families'&&page==='family-detail')||( item.id==='patients'&&['patient-detail','vaccines'].includes(page))
                  ?'text-indigo-600':'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
              <div className={`p-1.5 rounded-xl transition-all ${page===item.id?'bg-indigo-50 dark:bg-indigo-900/30':''}`}>
                <span className="text-xl">{item.icon}</span>
              </div>
              <span className="text-xs font-semibold">{item.label}</span>
              {page===item.id&&<div className="w-1 h-1 rounded-full bg-indigo-600"/>}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
