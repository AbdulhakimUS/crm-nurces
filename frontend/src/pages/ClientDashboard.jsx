import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/index.js';
import { useAuth } from '../hooks/useAuth';
import { dashboardApi } from '../api/dashboard';
import { familiesApi } from '../api/families';
import { patientsApi } from '../api/patients';
import { importApi } from '../api/importApi';
import { clientApi } from '../api/admin';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

const RISK_KEYS = ['pregnant','child05','chronic','disabled','normal'];
const RISK_COLORS = {
  pregnant:'bg-blue-100 text-blue-700 border-blue-300',
  child05:'bg-green-100 text-green-700 border-green-300',
  chronic:'bg-yellow-100 text-yellow-700 border-yellow-300',
  disabled:'bg-red-100 text-red-700 border-red-300',
  normal:'bg-gray-100 text-gray-600 border-gray-300',
};
const RISK_EMOJI = { pregnant:'🤰', child05:'👶', chronic:'💊', disabled:'♿', normal:'👤' };
const fmt = (d) => d ? new Date(d).toLocaleDateString('ru-RU',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const isOverdue = (d) => d && new Date(d) < new Date();

function RiskBadge({ cat }) {
  const { t } = useTranslation();
  const color = RISK_COLORS[cat]||RISK_COLORS.normal;
  const emoji = RISK_EMOJI[cat]||RISK_EMOJI.normal;
  return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${color}`}>{emoji} {t(`risk.${cat}`,cat)}</span>;
}

function StatusBadge({ status }) {
  const { t } = useTranslation();
  const m = { pending:'bg-amber-100 text-amber-700 border-amber-300', completed:'bg-green-100 text-green-700 border-green-300', missed:'bg-red-100 text-red-700 border-red-300' };
  return <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold capitalize ${m[status]||'bg-gray-100 text-gray-600 border-gray-200'}`}>{t(`visits.${status}`,status)}</span>;
}

function Spinner() {
  return <div className="flex justify-center items-center py-16"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/></div>;
}

function BackBtn({ onClick, label }) {
  const { t } = useTranslation();
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-indigo-400 hover:text-white text-sm font-semibold py-2 px-1 transition-colors">
      {label || t('nav.back')}
    </button>
  );
}

function Btn({ children, onClick, variant='primary', sm, type='button', disabled, full, className='' }) {
  const base = `inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl transition-all disabled:opacity-50 select-none ${sm?'px-3 py-1.5 text-xs':'px-4 py-2.5 text-sm'} ${full?'w-full':''} ${className}`;
  const v = { primary:'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm active:scale-95', outline:'border border-gray-300 text-gray-700 hover:bg-gray-50 bg-white active:scale-95', danger:'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 active:scale-95' };
  return <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${v[variant]||v.primary}`}>{children}</button>;
}

function Field({ label, children }) {
  return <div><label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>{children}</div>;
}
function Inp({ label, ...p }) {
  return <Field label={label}><input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white" {...p}/></Field>;
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

function PatientForm({ initial, familyId, families, onSaved, onClose }) {
  const { t } = useTranslation();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState({
    family_id: familyId||initial?.family_id||'', full_name: initial?.full_name||'',
    passport: initial?.passport||'', birth_date: initial?.birth_date?.split('T')[0]||'',
    blood_group: initial?.blood_group||'', risk_category: initial?.risk_category||'normal',
    height: initial?.height||'', weight: initial?.weight||'',
    blood_pressure: initial?.blood_pressure||'', notes: initial?.notes||'',
  });
  const [saving, setSaving] = useState(false);
  const set = k => e => setForm(p=>({...p,[k]:e.target.value}));

  const save = async () => {
    if (!form.full_name||!form.passport) { toast.error(t('common.nameRequired')); return; }
    setSaving(true);
    try {
      if (isEdit) await patientsApi.update(initial.id, form);
      else await patientsApi.create(form);
      toast.success(isEdit ? t('patients.updated') : t('patients.added'));
      onSaved();
    } catch(err) { toast.error(err.response?.data?.message||t('common.error')); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      {!familyId && (
        <Sel label={t('patients.family')} value={form.family_id} onChange={set('family_id')}>
          <option value="">{t('patients.noFamily')}</option>
          {families?.map(f=><option key={f.id} value={f.id}>{f.head_name}</option>)}
        </Sel>
      )}
      <Inp label={t('patients.fullName')} value={form.full_name} onChange={set('full_name')} placeholder="Lastname Firstname"/>
      <Inp label={t('patients.passport')} value={form.passport} onChange={set('passport')} placeholder="AA1234567"/>
      <div className="grid grid-cols-2 gap-3">
        <Inp label={t('patients.birthDate')} type="date" value={form.birth_date} onChange={set('birth_date')}/>
        <Sel label={t('patients.bloodGroup')} value={form.blood_group} onChange={set('blood_group')}>
          {['','A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g=><option key={g} value={g}>{g||t('patients.select')}</option>)}
        </Sel>
      </div>
      <Sel label={t('patients.riskCategory')} value={form.risk_category} onChange={set('risk_category')}>
        {RISK_KEYS.map(k=><option key={k} value={k}>{RISK_EMOJI[k]} {t(`risk.${k}`)}</option>)}
      </Sel>
      <div className="grid grid-cols-3 gap-2">
        <Inp label={t('patients.height')} type="number" value={form.height} onChange={set('height')} placeholder="165"/>
        <Inp label={t('patients.weight')} type="number" value={form.weight} onChange={set('weight')} placeholder="70"/>
        <Inp label={t('patients.bp')} value={form.blood_pressure} onChange={set('blood_pressure')} placeholder="120/80"/>
      </div>
      <Tex label={t('patients.notes')} value={form.notes} onChange={set('notes')} placeholder={t('patients.addNotes')}/>
      <div className="flex gap-2 pt-1">
        <Btn variant="outline" onClick={onClose} full>{t('patients.cancel')}</Btn>
        <Btn onClick={save} disabled={saving} full>{saving?t('patients.saving'):isEdit?t('patients.update'):t('patients.save')}</Btn>
      </div>
    </div>
  );
}

function PatientPage({ patientId, onBack, onDeleted }) {
  const { t } = useTranslation();
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
    try { const [r,fam] = await Promise.all([patientsApi.get(patientId), familiesApi.list()]); setData(r.data); setFamilies(fam.data); }
    catch { toast.error(t('common.failedLoad')); }
    finally { setLoading(false); }
  }, [patientId, t]);

  useEffect(()=>{ load(); },[load]);

  const del = async () => {
    if (!confirm(t('patients.confirmDelete'))) return;
    try { await patientsApi.delete(patientId); toast.success(t('common.deleted')); onDeleted?.(); onBack(); }
    catch { toast.error(t('common.error')); }
  };

  const uploadImg = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const fd = new FormData(); fd.append('photo',f);
    try { const r = await clientApi.updatePhoto(fd); await patientsApi.addImage(patientId,{image_url:r.data.photo_path,caption:imgCaption}); toast.success(t('profile.photoUpdated')); setImgCaption(''); load(); }
    catch { toast.error(t('profile.uploadFailed')); }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 dark:bg-gray-900"><div className="bg-gray-900 px-4 pt-4 pb-4"><BackBtn onClick={onBack}/></div><Spinner/></div>;
  if (!data) return null;
  const { patient, visits=[], history=[], vaccines=[], medications=[], images=[] } = data;
  const tabKeys = ['info','history','visits','vaccines','meds','images'];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gray-900 text-white px-4 pt-4 pb-4 sticky top-0 z-30 shadow-xl">
        <BackBtn onClick={onBack}/>
        <div className="flex items-start justify-between gap-3 mt-1">
          <div>
            <h1 className="text-xl font-bold leading-tight">{patient.full_name}</h1>
            <p className="text-gray-400 text-xs mt-0.5">{patient.passport}{patient.birth_date&&` · ${fmt(patient.birth_date)}`}{patient.blood_group&&` · ${patient.blood_group}`}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {patient.risk_category&&patient.risk_category!=='normal'&&<RiskBadge cat={patient.risk_category}/>}
              {visits[0]?.next_visit_date&&isOverdue(visits[0].next_visit_date)&&visits[0].status!=='completed'&&
                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-semibold">{t('visits.title')} {t('home.overdue')}</span>}
              {vaccines[0]?.next_date&&isOverdue(vaccines[0].next_date)&&
                <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-semibold">{t('vaccines.title')} {t('home.overdue')}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-1 mt-3 overflow-x-auto pb-0.5 no-scrollbar">
          {tabKeys.map(tk=>(
            <button key={tk} onClick={()=>setTab(tk)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex-shrink-0 capitalize ${tab===tk?'bg-indigo-600 text-white':'text-gray-400 hover:text-white hover:bg-white/10'}`}>
              {t(`tabs.${tk}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 pb-24 space-y-3 max-w-2xl mx-auto">
        {tab==='info'&&(editMode?(
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100">
            <PatientForm initial={patient} families={families} onSaved={()=>{setEditMode(false);load();}} onClose={()=>setEditMode(false)}/>
          </div>
        ):(
          <>
            <div className="grid grid-cols-2 gap-3">
              {[[t('patients.height'),patient.height?`${patient.height} cm`:'—'],[t('patients.weight'),patient.weight?`${patient.weight} kg`:'—'],[t('patients.bp'),patient.blood_pressure||'—'],[t('patients.bloodGroup'),patient.blood_group||'—']].map(([l,v])=>(
                <div key={l} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-400 font-medium">{l}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{v}</p>
                </div>
              ))}
            </div>
            {patient.notes&&<div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-gray-700">📝 {patient.notes}</div>}
            <button onClick={()=>setEditMode(true)} className="w-full py-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-semibold text-sm hover:bg-gray-50 transition shadow-sm">✏️ {t('patients.edit')}</button>
            <button onClick={del} className="w-full flex items-center justify-center gap-2 text-red-500 font-semibold text-sm border border-red-200 rounded-2xl px-4 py-3 hover:bg-red-50 transition">🗑️ {t('patients.delete')}</button>
          </>
        ))}

        {tab==='history'&&(
          <>
            {showHistory?(
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
                <h3 className="font-semibold text-gray-800 dark:text-white">{t('history.addTitle')}</h3>
                <Inp label={t('history.date')} type="date" value={histForm.visit_date} onChange={e=>setHistForm(p=>({...p,visit_date:e.target.value}))}/>
                <Inp label={t('history.diagnosis')} value={histForm.diagnosis} onChange={e=>setHistForm(p=>({...p,diagnosis:e.target.value}))}/>
                <Inp label={t('history.medication')} value={histForm.medication} onChange={e=>setHistForm(p=>({...p,medication:e.target.value}))}/>
                <Tex label={t('history.notes')} value={histForm.notes} onChange={e=>setHistForm(p=>({...p,notes:e.target.value}))}/>
                <div className="flex gap-2">
                  <Btn variant="outline" onClick={()=>setShowHistory(false)} full>{t('history.cancel')}</Btn>
                  <Btn full onClick={async()=>{await patientsApi.addHistory(patientId,histForm);toast.success(t('history.added'));setShowHistory(false);load();}}>{t('history.save')}</Btn>
                </div>
              </div>
            ):(
              <button onClick={()=>setShowHistory(true)} className="w-full py-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 font-medium text-sm hover:bg-gray-50 transition">{t('history.add')}</button>
            )}
            {history.map(h=>(
              <div key={h.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 relative">
                <button onClick={async()=>{await patientsApi.deleteHistory(patientId,h.id);load();}} className="absolute top-3 right-3 text-gray-300 hover:text-red-500 text-lg transition">🗑</button>
                <p className="text-xs text-gray-400 font-medium">📅 {fmt(h.visit_date)}</p>
                <p className="font-bold text-gray-900 dark:text-white mt-1">{h.diagnosis||t('visits.title')}</p>
                {h.medication&&<p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">💊 {h.medication}</p>}
                {h.notes&&<p className="text-sm text-gray-400 italic mt-1">{h.notes}</p>}
              </div>
            ))}
            {!history.length&&!showHistory&&<div className="text-center py-12 text-gray-400 text-sm">{t('history.noHistory')}</div>}
          </>
        )}

        {tab==='visits'&&(
          <>
            {showVisit?(
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
                <h3 className="font-semibold text-gray-800 dark:text-white">{t('visits.addTitle')}</h3>
                <Inp label={t('visits.visitDate')} type="date" value={visitForm.visit_date} onChange={e=>setVisitForm(p=>({...p,visit_date:e.target.value}))}/>
                <Inp label={t('visits.nextVisitDate')} type="date" value={visitForm.next_visit_date} onChange={e=>setVisitForm(p=>({...p,next_visit_date:e.target.value}))}/>
                <Sel label={t('visits.status')} value={visitForm.status} onChange={e=>setVisitForm(p=>({...p,status:e.target.value}))}>
                  <option value="pending">{t('visits.pending')}</option>
                  <option value="completed">{t('visits.completed')}</option>
                  <option value="missed">{t('visits.missed')}</option>
                </Sel>
                <div className="flex gap-2">
                  <Btn variant="outline" onClick={()=>setShowVisit(false)} full>{t('visits.cancel')}</Btn>
                  <Btn full onClick={async()=>{await patientsApi.addVisit(patientId,visitForm);toast.success(t('visits.added'));setShowVisit(false);load();}}>{t('visits.save')}</Btn>
                </div>
              </div>
            ):(
              <button onClick={()=>setShowVisit(true)} className="w-full py-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 font-medium text-sm hover:bg-gray-50 transition">{t('visits.add')}</button>
            )}
            {visits.map(v=>(
              <div key={v.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">📅 {fmt(v.visit_date)}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5 flex items-center gap-2">{t('visits.next')}: {fmt(v.next_visit_date)}{isOverdue(v.next_visit_date)&&v.status!=='completed'&&<span className="px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200 text-xs">{t('visits.overdue')}</span>}</p>
                </div>
                <div className="flex items-center gap-2"><StatusBadge status={v.status}/><button onClick={async()=>{await patientsApi.deleteVisit(patientId,v.id);load();}} className="text-gray-300 hover:text-red-500 transition text-lg">🗑</button></div>
              </div>
            ))}
            {!visits.length&&!showVisit&&<div className="text-center py-12 text-gray-400 text-sm">{t('visits.noVisits')}</div>}
          </>
        )}

        {tab==='vaccines'&&(
          <>
            {showVaccine?(
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
                <h3 className="font-semibold text-gray-800 dark:text-white">{t('vaccines.addTitle')}</h3>
                <Inp label={t('vaccines.name')} value={vacForm.vaccine_name} onChange={e=>setVacForm(p=>({...p,vaccine_name:e.target.value}))} placeholder="BCG, DTP, COVID-19..."/>
                <div className="grid grid-cols-2 gap-3">
                  <Inp label={t('vaccines.dateGiven')} type="date" value={vacForm.date_given} onChange={e=>setVacForm(p=>({...p,date_given:e.target.value}))}/>
                  <Inp label={t('vaccines.nextDate')} type="date" value={vacForm.next_date} onChange={e=>setVacForm(p=>({...p,next_date:e.target.value}))}/>
                </div>
                <div className="flex gap-2">
                  <Btn variant="outline" onClick={()=>setShowVaccine(false)} full>{t('vaccines.cancel')}</Btn>
                  <Btn full onClick={async()=>{if(!vacForm.vaccine_name){toast.error(t('vaccines.nameRequired'));return;}await patientsApi.addVaccine(patientId,vacForm);toast.success(t('vaccines.added'));setShowVaccine(false);load();}}>{t('vaccines.save')}</Btn>
                </div>
              </div>
            ):(
              <button onClick={()=>setShowVaccine(true)} className="w-full py-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 font-medium text-sm hover:bg-gray-50 transition">{t('vaccines.add')}</button>
            )}
            {vaccines.map(v=>(
              <div key={v.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">💉 {v.vaccine_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t('vaccines.dateGiven')}: {fmt(v.date_given)}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1.5">{t('vaccines.nextDate')}: {fmt(v.next_date)}{isOverdue(v.next_date)&&<span className="px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200 text-xs">{t('vaccines.overdue')}</span>}</p>
                </div>
                <button onClick={async()=>{await patientsApi.deleteVaccine(patientId,v.id);load();}} className="text-gray-300 hover:text-red-500 transition text-lg">🗑</button>
              </div>
            ))}
            {!vaccines.length&&!showVaccine&&<div className="text-center py-12 text-gray-400 text-sm">{t('vaccines.noVaccines')}</div>}
          </>
        )}

        {tab==='meds'&&(
          <>
            {showMed?(
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
                <h3 className="font-semibold text-gray-800 dark:text-white">{t('meds.addTitle')}</h3>
                <Inp label={t('meds.name')} value={medForm.medicine_name} onChange={e=>setMedForm(p=>({...p,medicine_name:e.target.value}))}/>
                <div className="grid grid-cols-3 gap-2">
                  <Inp label={t('meds.quantity')} value={medForm.quantity} onChange={e=>setMedForm(p=>({...p,quantity:e.target.value}))} placeholder="60 tabs"/>
                  <Inp label={t('meds.timesDay')} type="number" min="1" value={medForm.times_per_day} onChange={e=>setMedForm(p=>({...p,times_per_day:e.target.value}))}/>
                  <Inp label={t('meds.days')} type="number" min="1" value={medForm.duration_days} onChange={e=>setMedForm(p=>({...p,duration_days:e.target.value}))}/>
                </div>
                <Inp label={t('meds.dateGiven')} type="date" value={medForm.date_given} onChange={e=>setMedForm(p=>({...p,date_given:e.target.value}))}/>
                <div className="flex gap-2">
                  <Btn variant="outline" onClick={()=>setShowMed(false)} full>{t('meds.cancel')}</Btn>
                  <Btn full onClick={async()=>{if(!medForm.medicine_name){toast.error(t('meds.nameRequired'));return;}await patientsApi.addMedication(patientId,medForm);toast.success(t('meds.added'));setShowMed(false);load();}}>{t('meds.save')}</Btn>
                </div>
              </div>
            ):(
              <button onClick={()=>setShowMed(true)} className="w-full py-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 font-medium text-sm hover:bg-gray-50 transition">{t('meds.add')}</button>
            )}
            {medications.map(m=>(
              <div key={m.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">💊 {m.medicine_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.quantity&&`${m.quantity} · `}{m.times_per_day}x · {m.duration_days} {t('meds.days').toLowerCase()} · {fmt(m.date_given)}</p>
                </div>
                <button onClick={async()=>{await patientsApi.deleteMedication(patientId,m.id);load();}} className="text-gray-300 hover:text-red-500 transition text-lg">🗑</button>
              </div>
            ))}
            {!medications.length&&!showMed&&<div className="text-center py-12 text-gray-400 text-sm">{t('meds.noMeds')}</div>}
          </>
        )}

        {tab==='images'&&(
          <>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
              <Inp label={t('images.caption')} value={imgCaption} onChange={e=>setImgCaption(e.target.value)} placeholder={t('images.captionPlaceholder')}/>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadImg}/>
              <button onClick={()=>fileRef.current.click()} className="w-full py-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 font-medium text-sm transition border border-gray-200">{t('images.upload')}</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {images.map(img=>(
                <div key={img.id} className="relative rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white">
                  <img src={img.image_url} alt={img.caption} className="w-full h-36 object-cover"/>
                  {img.caption&&<p className="text-xs text-gray-600 p-2">{img.caption}</p>}
                  <button onClick={async()=>{await patientsApi.deleteImage(patientId,img.id);load();}} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">×</button>
                </div>
              ))}
            </div>
            {!images.length&&<div className="text-center py-12 text-gray-400 text-sm">{t('images.noImages')}</div>}
          </>
        )}
      </div>
    </div>
  );
}

function FamilyPage({ familyId, onBack, onPatientSelect }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [editForm, setEditForm] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await familiesApi.get(familyId); setData(r.data); setEditForm(r.data.family); }
    catch { toast.error(t('common.failedLoad')); }
    finally { setLoading(false); }
  }, [familyId, t]);

  useEffect(()=>{ load(); },[load]);

  if (loading) return <div className="min-h-screen bg-gray-50 dark:bg-gray-900"><div className="bg-gray-900 px-4 pt-4 pb-4"><BackBtn onClick={onBack} label={t('nav.backToFamilies')}/></div><Spinner/></div>;
  if (!data) return null;
  const { family, members=[] } = data;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-gray-900 text-white sticky top-0 z-30 shadow-xl">
        <div className="px-4 pt-4 pb-5">
          <BackBtn onClick={onBack} label={t('nav.backToFamilies')}/>
          <div className="flex items-start justify-between mt-2">
            <div>
              <h1 className="text-xl font-bold">🏠 {family.head_name}</h1>
              <div className="mt-1 space-y-0.5">
                {family.address&&<p className="text-gray-400 text-sm flex items-center gap-1.5"><span>📍</span>{family.address}</p>}
                {family.phone&&<p className="text-gray-400 text-sm flex items-center gap-1.5"><span>📞</span>{family.phone}</p>}
              </div>
            </div>
            <div className="flex gap-2 mt-1">
              <button onClick={()=>setShowEdit(p=>!p)} className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition text-lg">✏️</button>
              <button onClick={async()=>{if(!confirm(t('families.confirmDelete')))return;await familiesApi.delete(familyId);toast.success(t('common.deleted'));onBack();}} className="w-10 h-10 rounded-xl bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition text-lg">🗑️</button>
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 py-4 pb-24 max-w-2xl mx-auto space-y-4">
        {showEdit&&(
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
            <h3 className="font-semibold text-gray-800 dark:text-white">{t('families.edit')}</h3>
            <Inp label={t('families.headOfFamily')} value={editForm.head_name||''} onChange={e=>setEditForm(p=>({...p,head_name:e.target.value}))}/>
            <Inp label={t('families.address')} value={editForm.address||''} onChange={e=>setEditForm(p=>({...p,address:e.target.value}))}/>
            <Inp label={t('families.phone')} value={editForm.phone||''} onChange={e=>setEditForm(p=>({...p,phone:e.target.value}))}/>
            <div className="flex gap-2">
              <Btn variant="outline" onClick={()=>setShowEdit(false)} full>{t('families.cancel')}</Btn>
              <Btn full onClick={async()=>{await familiesApi.update(familyId,editForm);toast.success(t('families.updated'));setShowEdit(false);load();}}>{t('families.save')}</Btn>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900 dark:text-white text-lg">{t('families.members')} ({members.length})</h2>
          <Btn sm onClick={()=>setShowAddMember(p=>!p)}>{showAddMember?t('families.cancel'):t('families.addMember')}</Btn>
        </div>
        {showAddMember&&(
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100">
            <PatientForm familyId={familyId} onSaved={()=>{setShowAddMember(false);load();}} onClose={()=>setShowAddMember(false)}/>
          </div>
        )}
        {members.length===0&&!showAddMember&&<div className="text-center py-12 text-gray-400"><div className="text-4xl mb-2">👥</div><p className="text-sm">{t('families.noMembers')}</p></div>}
        <div className="space-y-2">
          {members.map(m=>(
            <div key={m.id} onClick={()=>onPatientSelect(m.id)} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-indigo-200 hover:shadow-md transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-bold text-gray-900 dark:text-white">{m.full_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{fmt(m.birth_date)} · {m.passport}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {m.risk_category&&m.risk_category!=='normal'&&<RiskBadge cat={m.risk_category}/>}
                    {isOverdue(m.next_visit)&&<span className="px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200 text-xs font-semibold">{t('home.overdue')}</span>}
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

function HomeDashboard({ onNavigate }) {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    dashboardApi.getStats().then(r=>setStats(r.data)).catch(()=>toast.error(t('common.error'))).finally(()=>setLoading(false));
  },[t]);

  if (loading) return <Spinner/>;
  if (!stats) return null;

  const cards = [
    { icon:'👥', val:stats.total_patients, label:t('home.totalPatients'), color:'text-indigo-600', page:'patients' },
    { icon:'⚠️', val:stats.missed_visits, label:t('home.missedVisits'), color:'text-red-500', page:'patients', filter:'missed' },
    { icon:'💉', val:stats.upcoming_vaccines, label:t('home.upcomingVaccines'), color:'text-amber-500', page:'vaccines' },
    { icon:'🏠', val:stats.total_families, label:t('home.families'), color:'text-emerald-600', page:'families' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {cards.map(c=>(
          <button key={c.label} onClick={()=>onNavigate(c.page,c.filter)} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 text-left hover:border-indigo-200 hover:shadow-md transition active:scale-95">
            <div className="text-3xl mb-2">{c.icon}</div>
            <div className={`text-3xl font-black ${c.color}`}>{c.val}</div>
            <div className="text-xs text-gray-500 mt-1 font-medium">{c.label}</div>
          </button>
        ))}
      </div>
      {stats.risk_groups?.length>0&&(
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">{t('home.riskGroups')}</h3>
          <div className="space-y-2">
            {stats.risk_groups.map(rg=>(
              <button key={rg.risk_category} onClick={()=>onNavigate('patients',rg.risk_category)}
                className={`flex items-center justify-between w-full p-3 rounded-xl border ${RISK_COLORS[rg.risk_category]||RISK_COLORS.normal} hover:opacity-80 transition active:scale-95`}>
                <span className="font-semibold text-sm">{RISK_EMOJI[rg.risk_category]||'👤'} {t(`risk.${rg.risk_category}`,rg.risk_category)}</span>
                <span className="font-bold">{rg.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {stats.reminders?.length>0&&(
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white mb-3">{t('home.reminders')}</h3>
          <div className="space-y-2">
            {stats.reminders.map((r,i)=>(
              <div key={i} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800">
                <div><p className="font-semibold text-sm text-gray-900 dark:text-white">{r.full_name}</p><p className="text-xs text-gray-500">{r.type}</p></div>
                <span className="text-red-500 font-bold text-xs">{t('home.overdue')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FamiliesList({ onFamilySelect }) {
  const { t } = useTranslation();
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ head_name:'', address:'', phone:'' });

  const load = () => familiesApi.list().then(r=>setFamilies(r.data)).catch(()=>toast.error(t('common.error'))).finally(()=>setLoading(false));
  useEffect(()=>{ load(); },[]);

  const add = async () => {
    if (!addForm.head_name) { toast.error(t('common.nameRequired')); return; }
    try { await familiesApi.create(addForm); toast.success(t('families.updated')); setShowAdd(false); setAddForm({head_name:'',address:'',phone:''}); load(); }
    catch { toast.error(t('common.error')); }
  };

  if (loading) return <Spinner/>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white">{t('families.title')}</h2>
        <Btn onClick={()=>setShowAdd(true)}>{t('families.add')}</Btn>
      </div>
      <Modal open={showAdd} onClose={()=>setShowAdd(false)} title={t('families.addTitle')}>
        <div className="space-y-3">
          <Inp label={t('families.headOfFamily')} value={addForm.head_name} onChange={e=>setAddForm(p=>({...p,head_name:e.target.value}))}/>
          <Inp label={t('families.address')} value={addForm.address} onChange={e=>setAddForm(p=>({...p,address:e.target.value}))}/>
          <Inp label={t('families.phone')} value={addForm.phone} onChange={e=>setAddForm(p=>({...p,phone:e.target.value}))} placeholder="+998..."/>
          <div className="flex gap-2"><Btn variant="outline" onClick={()=>setShowAdd(false)} full>{t('families.cancel')}</Btn><Btn onClick={add} full>{t('families.save')}</Btn></div>
        </div>
      </Modal>
      {families.length===0?(
        <div className="text-center py-16 text-gray-400"><div className="text-5xl mb-3">🏠</div><p className="text-sm font-medium">{t('families.noFamilies')}</p></div>
      ):(
        <div className="space-y-3">
          {families.map(f=>(
            <div key={f.id} onClick={()=>onFamilySelect(f.id)} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-indigo-200 hover:shadow-md transition active:scale-98">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">🏠 {f.head_name}</p>
                  {f.address&&<p className="text-sm text-gray-500 mt-0.5">📍 {f.address}</p>}
                  {f.phone&&<p className="text-sm text-gray-500">📞 {f.phone}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-2">{f.risk_categories?.filter(Boolean).map(r=><RiskBadge key={r} cat={r}/>)}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-indigo-600 font-bold text-xl">{f.member_count}</span>
                  <p className="text-xs text-gray-400">{t('common.members')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PatientsList({ initialRisk, initialVisit, onPatientSelect }) {
  const { t } = useTranslation();
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
    } catch { toast.error(t('common.error')); }
    finally { setLoading(false); }
  }, [search, risk, visitStatus, t]);

  useEffect(()=>{ load(); },[load]);
  useEffect(()=>{ familiesApi.list().then(r=>setFamilies(r.data)).catch(()=>{}); },[]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900 dark:text-white">{t('patients.title')}</h2>
        <Btn sm onClick={()=>setShowAdd(true)}>{t('patients.add')}</Btn>
      </div>
      <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-2xl px-4 py-3 shadow-sm">
        <span className="text-gray-400">🔍</span>
        <input className="flex-1 text-sm outline-none bg-transparent dark:text-white" placeholder={t('patients.search')} value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      <div className="flex gap-2 flex-wrap">
        <select value={risk} onChange={e=>setRisk(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="all">{t('patients.allRisk')}</option>
          {RISK_KEYS.map(k=><option key={k} value={k}>{RISK_EMOJI[k]} {t(`risk.${k}`)}</option>)}
        </select>
        <select value={visitStatus} onChange={e=>setVisitStatus(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="all">{t('patients.allVisits')}</option>
          <option value="pending">{t('visits.pending')}</option>
          <option value="completed">{t('visits.completed')}</option>
          <option value="missed">{t('visits.missed')}</option>
        </select>
      </div>
      <p className="text-xs text-gray-500">{patients.length} {t('patients.found')}</p>
      <Modal open={showAdd} onClose={()=>setShowAdd(false)} title={t('patients.addTitle')} wide>
        <PatientForm families={families} onSaved={()=>{setShowAdd(false);load();}} onClose={()=>setShowAdd(false)}/>
      </Modal>
      {loading?<Spinner/>:patients.length===0?(
        <div className="text-center py-16 text-gray-400"><div className="text-5xl mb-3">👥</div><p className="text-sm font-medium">{t('patients.noPatients')}</p></div>
      ):(
        <div className="space-y-2">
          {patients.map(p=>(
            <div key={p.id} onClick={()=>onPatientSelect(p.id)} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-indigo-200 hover:shadow-md transition active:scale-98">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900 dark:text-white">{p.full_name}</p>
                    {p.risk_category&&p.risk_category!=='normal'&&<RiskBadge cat={p.risk_category}/>}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{fmt(p.birth_date)}{p.blood_group&&` · ${p.blood_group}`}</p>
                  {p.family_name&&<p className="text-xs text-gray-400 mt-0.5">🏠 {p.family_name}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.last_visit_status&&<StatusBadge status={p.last_visit_status}/>}
                    {p.next_visit_date&&isOverdue(p.next_visit_date)&&p.last_visit_status!=='completed'&&<span className="px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200 text-xs font-semibold">{t('home.overdue')}</span>}
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

function VaccinesPage({ onPatientSelect, onBack }) {
  const { t } = useTranslation();
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
    }).catch(()=>toast.error(t('common.error'))).finally(()=>setLoading(false));
  },[t]);

  if (loading) return <Spinner/>;
  const overdue = vaccines.filter(v=>isOverdue(v.next_date));
  const upcoming = vaccines.filter(v=>v.next_date&&!isOverdue(v.next_date));
  const noDate = vaccines.filter(v=>!v.next_date);

  const VCard = ({v}) => (
    <div onClick={()=>onPatientSelect(v.patient_id)} className="flex items-center justify-between p-3 rounded-xl border cursor-pointer hover:opacity-80 transition active:scale-95 bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700">
      <div>
        <p className="font-semibold text-gray-900 dark:text-white text-sm">💉 {v.vaccine_name}</p>
        <p className="text-xs text-gray-500">{v.patient_name}</p>
        <p className="text-xs text-gray-400">{t('vaccines.dateGiven')}: {fmt(v.date_given)}{v.next_date&&` · ${t('vaccines.nextDate')}: ${fmt(v.next_date)}`}</p>
      </div>
      {isOverdue(v.next_date)&&<span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">{t('vaccines.overdue')}</span>}
    </div>
  );

  return (
    <div className="space-y-4">
      {onBack&&<BackBtn onClick={onBack}/>}
      <h2 className="text-2xl font-black text-gray-900 dark:text-white">{t('vaccines.title')}</h2>
      {vaccines.length===0&&<div className="text-center py-16 text-gray-400"><div className="text-5xl mb-3">💉</div><p className="text-sm">{t('vaccines.noVaccines')}</p></div>}
      {overdue.length>0&&<div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 border border-red-100 dark:border-red-800"><h3 className="font-bold text-red-600 mb-3 text-sm uppercase">⚠️ {t('vaccines.overdue')} ({overdue.length})</h3><div className="space-y-2">{overdue.map(v=><VCard key={v.id} v={v}/>)}</div></div>}
      {upcoming.length>0&&<div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"><h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3 text-sm uppercase">📅 {t('vaccines.upcoming')} ({upcoming.length})</h3><div className="space-y-2">{upcoming.map(v=><VCard key={v.id} v={v}/>)}</div></div>}
      {noDate.length>0&&<div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"><h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3 text-sm uppercase">✅ {t('vaccines.given')} ({noDate.length})</h3><div className="space-y-2">{noDate.map(v=><VCard key={v.id} v={v}/>)}</div></div>}
    </div>
  );
}

// ── EXPORT — с расширенными фильтрами ─────────────────────
function ExportPage({ onBack }) {
  const { t } = useTranslation();
  const [allPatients, setAllPatients] = useState([]);
  const [families, setFamilies] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [format, setFormat] = useState('xlsx');
  const [filterName, setFilterName] = useState('');
  const [filterRisk, setFilterRisk] = useState('all');
  const [filterVisit, setFilterVisit] = useState('all');
  const [filterAddress, setFilterAddress] = useState('');
  const [filterVaccine, setFilterVaccine] = useState('');

  useEffect(()=>{
    Promise.all([patientsApi.list({}), familiesApi.list()])
      .then(async ([pr, fr]) => {
        const pts = pr.data;
        // загружаем вакцины для каждого пациента
        const withVaccines = await Promise.all(pts.map(async p => {
          try { const vr = await patientsApi.getVaccines(p.id); return {...p, vaccines: vr.data}; }
          catch { return {...p, vaccines:[]}; }
        }));
        setAllPatients(withVaccines);
        setFamilies(fr.data);
      })
      .catch(()=>toast.error(t('common.error')))
      .finally(()=>setLoading(false));
  },[t]);

  // Фильтрация на клиенте
  const filtered = allPatients.filter(p => {
    if (filterName && !p.full_name?.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterRisk !== 'all' && p.risk_category !== filterRisk) return false;
    if (filterVisit !== 'all' && p.last_visit_status !== filterVisit) return false;
    if (filterAddress) {
      const fam = families.find(f => f.id === p.family_id || f.id === Number(p.family_id));
      if (!fam?.address?.toLowerCase().includes(filterAddress.toLowerCase())) return false;
    }
    if (filterVaccine) {
      const hasVac = p.vaccines?.some(v => v.vaccine_name?.toLowerCase().includes(filterVaccine.toLowerCase()));
      if (!hasVac) return false;
    }
    return true;
  });

  const toggle = (id) => setSelected(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const toggleAll = () => setSelected(selected.length===filtered.length&&filtered.length>0?[]:filtered.map(p=>p.id));

  const doExport = () => {
    const toExport = selected.length>0 ? filtered.filter(p=>selected.includes(p.id)) : filtered;
    const rows = toExport.map(p => {
      const fam = families.find(f=>f.id===p.family_id||f.id===Number(p.family_id));
      return {
        [t('patients.fullName')]: p.full_name,
        [t('patients.passport')]: p.passport,
        [t('patients.birthDate')]: p.birth_date ? new Date(p.birth_date).toLocaleDateString('ru-RU') : '',
        [t('patients.bloodGroup')]: p.blood_group||'',
        [t('patients.riskCategory')]: t(`risk.${p.risk_category}`,p.risk_category)||'',
        [t('families.title')]: fam?.head_name||p.family_name||'',
        [t('families.address')]: fam?.address||'',
        [t('families.phone')]: fam?.phone||'',
        [t('patients.height')]: p.height||'',
        [t('patients.weight')]: p.weight||'',
        [t('patients.bp')]: p.blood_pressure||'',
        [t('vaccines.title')]: p.vaccines?.map(v=>v.vaccine_name).join(', ')||'',
        [t('patients.notes')]: p.notes||'',
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('patients.title'));
    XLSX.writeFile(wb, `patients_${new Date().toISOString().split('T')[0]}.${format}`);
    toast.success(`${toExport.length} ${t('export.success')}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm">{t('export.back')}</button>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white">{t('export.title')}</h2>
      </div>

      {/* Формат */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">{t('export.format')}</p>
        <div className="flex gap-2">
          {[['xlsx','📊 Excel'],['csv','📄 CSV']].map(([val,label])=>(
            <button key={val} onClick={()=>setFormat(val)}
              className={`flex-1 p-3 rounded-xl border-2 text-sm font-semibold transition ${format===val?'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300':'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-600 dark:text-gray-300'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Фильтры */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-3">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('export.filters')}</p>
        <div className="flex items-center gap-2 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5">
          <span className="text-gray-400">👤</span>
          <input className="flex-1 text-sm outline-none bg-transparent dark:text-white" placeholder={t('export.searchName')} value={filterName} onChange={e=>setFilterName(e.target.value)}/>
        </div>
        <div className="flex items-center gap-2 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5">
          <span className="text-gray-400">📍</span>
          <input className="flex-1 text-sm outline-none bg-transparent dark:text-white" placeholder={t('export.searchAddress')} value={filterAddress} onChange={e=>setFilterAddress(e.target.value)}/>
        </div>
        <div className="flex items-center gap-2 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5">
          <span className="text-gray-400">💉</span>
          <input className="flex-1 text-sm outline-none bg-transparent dark:text-white" placeholder={t('export.searchVaccine')} value={filterVaccine} onChange={e=>setFilterVaccine(e.target.value)}/>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select value={filterRisk} onChange={e=>setFilterRisk(e.target.value)} className="border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="all">{t('export.allRisk')}</option>
            {RISK_KEYS.map(k=><option key={k} value={k}>{RISK_EMOJI[k]} {t(`risk.${k}`)}</option>)}
          </select>
          <select value={filterVisit} onChange={e=>setFilterVisit(e.target.value)} className="border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="all">{t('export.allVisit')}</option>
            <option value="pending">{t('visits.pending')}</option>
            <option value="completed">{t('visits.completed')}</option>
            <option value="missed">{t('visits.missed')}</option>
          </select>
        </div>
      </div>

      {/* Список */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={selected.length===filtered.length&&filtered.length>0} onChange={toggleAll} className="w-4 h-4 accent-indigo-600"/>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{t('export.selectAll')} ({filtered.length})</span>
          </label>
          <span className="text-xs text-gray-400">{selected.length>0?`${selected.length} ${t('export.selected')}`:t('export.allWillExport')}</span>
        </div>
        {loading?<Spinner/>:(
          <div className="divide-y divide-gray-50 dark:divide-gray-700 max-h-64 overflow-y-auto">
            {filtered.map(p=>{
              const fam = families.find(f=>f.id===p.family_id||f.id===Number(p.family_id));
              return (
                <label key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition">
                  <input type="checkbox" checked={selected.includes(p.id)} onChange={()=>toggle(p.id)} className="w-4 h-4 accent-indigo-600 flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{p.full_name}</p>
                    <p className="text-xs text-gray-400">{p.passport}{fam?.address?` · 📍 ${fam.address}`:''}</p>
                    {p.vaccines?.length>0&&<p className="text-xs text-indigo-500">💉 {p.vaccines.map(v=>v.vaccine_name).join(', ')}</p>}
                  </div>
                  {p.risk_category&&p.risk_category!=='normal'&&<RiskBadge cat={p.risk_category}/>}
                </label>
              );
            })}
            {filtered.length===0&&<div className="text-center py-8 text-gray-400 text-sm">{t('patients.noPatients')}</div>}
          </div>
        )}
      </div>

      <Btn onClick={doExport} full className="py-4 text-base">{t('export.btn')} {selected.length>0?selected.length:filtered.length} {t('patients.title')}</Btn>
    </div>
  );
}

function ImportPage({ onBack, onDone }) {
  const { t } = useTranslation();
  const [step, setStep] = useState('upload');
  const [analysis, setAnalysis] = useState(null);
  const [mapping, setMapping] = useState({});
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const fileRef = useRef();

  const FIELDS = {
    family_head:t('families.headOfFamily'), family_address:t('families.address'), family_phone:t('families.phone'),
    full_name:t('patients.fullName'), passport:t('patients.passport'), birth_date:t('patients.birthDate'),
    blood_group:t('patients.bloodGroup'), risk_category:t('patients.riskCategory'),
    height:t('patients.height'), weight:t('patients.weight'), blood_pressure:t('patients.bp'), notes:t('patients.notes'),
  };

  const analyze = async(f)=>{
    setLoading(true);
    const fd = new FormData(); fd.append('file',f);
    try { const r = await importApi.analyze(fd); setAnalysis(r.data); setMapping(r.data.mapping||{}); setStep('mapping'); }
    catch { toast.error(t('import.analysisFailed')); }
    finally { setLoading(false); }
  };

  const process = async()=>{
    setLoading(true);
    const fd = new FormData(); fd.append('file',file); fd.append('mapping',JSON.stringify(mapping));
    try { const r = await importApi.process(fd); setResults(r.data.results); setStep('results'); }
    catch { toast.error(t('import.importFailed')); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm">{t('import.back')}</button>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white">{t('import.title')}</h2>
      </div>
      {step==='upload'&&(
        <>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl p-4 text-sm text-blue-700 dark:text-blue-300">
            <p className="font-semibold mb-1">{t('import.formatTitle')}</p>
            <ul className="space-y-0.5 text-xs">
              <li>• {t('import.formatCols')}</li><li>• {t('import.formatRequired')}</li>
              <li>• {t('import.formatOptional')}</li><li>• {t('import.formatTypes')}</li>
            </ul>
          </div>
          <div onClick={()=>fileRef.current.click()} className="border-2 border-dashed border-indigo-300 rounded-2xl p-12 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition">
            <div className="text-5xl mb-3">📊</div>
            <p className="font-bold text-gray-700">{t('import.tapToSelect')}</p>
            <p className="text-sm text-gray-400 mt-1">.xlsx · .xls · .csv</p>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f){setFile(f);analyze(f);}}}/>
          {loading&&<div className="text-center py-4"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"/><p className="text-sm text-indigo-600">{t('import.analyzing')}</p></div>}
        </>
      )}
      {step==='mapping'&&analysis&&(
        <>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-3 text-sm text-green-700">✓ {analysis.total_rows} {t('import.rowsFound')}</div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {Object.entries(FIELDS).map(([field,label])=>(
                <div key={field} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-xs font-bold text-indigo-600 w-28 flex-shrink-0 leading-tight">{label}</span>
                  <span className="text-gray-300">→</span>
                  <select value={mapping[field]||''} onChange={e=>setMapping(p=>({...p,[field]:e.target.value||null}))}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-400">
                    <option value="">{t('common.notMapped')}</option>
                    {analysis.headers?.map(h=><option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Btn variant="outline" onClick={()=>setStep('upload')} full>{t('nav.back')}</Btn>
            <Btn onClick={process} disabled={loading} full>{loading?t('import.importing'):t('import.importNow')}</Btn>
          </div>
        </>
      )}
      {step==='results'&&results&&(
        <>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-3 text-green-700 font-semibold text-sm">{t('import.complete')}</div>
          <div className="grid grid-cols-2 gap-3">
            {[[t('import.createdFamilies'),results.created_families,'text-indigo-600'],[t('import.newPatients'),results.created_patients,'text-green-600'],[t('import.updatedP'),results.updated_patients,'text-amber-600'],[t('import.skipped'),results.skipped,'text-red-500']].map(([l,v,c])=>(
              <div key={l} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100"><div className={`text-2xl font-black ${c}`}>{v}</div><div className="text-xs text-gray-500 mt-1">{l}</div></div>
            ))}
          </div>
          {results.errors?.length>0&&<div className="bg-red-50 rounded-2xl p-3 border border-red-100 space-y-1">{results.errors.map((e,i)=><div key={i} className="text-xs text-red-600">Row {e.row}: {e.error}</div>)}</div>}
          <Btn onClick={onDone} full>{t('import.done')}</Btn>
        </>
      )}
    </div>
  );
}

function ProfilePage({ onExport, onImport, onBack }) {
  const { t } = useTranslation();
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
      if (form.theme==='dark') document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      i18n.changeLanguage(form.language);
      toast.success(t('profile.saved'));
    }
    catch { toast.error(t('common.error')); }
    finally { setSaving(false); }
  };

  const changeCred = async()=>{
    if (!pwForm.currentPassword) { toast.error(t('profile.currentPasswordRequired')); return; }
    try { await clientApi.updateCredentials(pwForm); toast.success(t('profile.updated')); setShowPw(false); setPwForm({currentPassword:'',newLogin:'',newPassword:''}); }
    catch(err) { toast.error(err.response?.data?.message||t('common.error')); }
  };

  const uploadPhoto = async(e)=>{
    const f = e.target.files?.[0]; if (!f) return;
    const fd = new FormData(); fd.append('photo',f);
    try { const r = await clientApi.updatePhoto(fd); updateUser({photo_path:r.data.photo_path}); toast.success(t('profile.photoUpdated')); }
    catch { toast.error(t('profile.uploadFailed')); }
  };

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {onBack&&<BackBtn onClick={onBack}/>}
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
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
        <h3 className="font-bold text-gray-900 dark:text-white">{t('profile.settings')}</h3>
        <Inp label={t('profile.name')} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/>
        <Inp label={t('profile.phone')} value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))}/>
        <div className="grid grid-cols-2 gap-3">
          <Sel label={t('profile.language')} value={form.language} onChange={e=>setForm(p=>({...p,language:e.target.value}))}>
            <option value="uz">🇺🇿 Uzbek</option>
            <option value="ru">🇷🇺 Russian</option>
            <option value="en">🇬🇧 English</option>
          </Sel>
          <Sel label={t('profile.theme')} value={form.theme} onChange={e=>{ setForm(p=>({...p,theme:e.target.value})); if(e.target.value==='dark') document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark'); }}>
            <option value="light">{t('profile.themeLight')}</option>
            <option value="dark">{t('profile.themeDark')}</option>
          </Sel>
        </div>
        <Btn onClick={save} disabled={saving} full>{saving?t('profile.saving'):t('profile.saveChanges')}</Btn>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-900 dark:text-white">{t('profile.credentials')}</h3>
          <button onClick={()=>setShowPw(p=>!p)} className="text-sm text-indigo-600 font-medium">{showPw?t('profile.cancel'):t('profile.change')}</button>
        </div>
        {showPw&&(
          <div className="space-y-3">
            <Inp label={t('profile.currentPassword')} type="password" value={pwForm.currentPassword} onChange={e=>setPwForm(p=>({...p,currentPassword:e.target.value}))}/>
            <Inp label={t('profile.newLogin')} value={pwForm.newLogin} onChange={e=>setPwForm(p=>({...p,newLogin:e.target.value}))}/>
            <Inp label={t('profile.newPassword')} type="password" value={pwForm.newPassword} onChange={e=>setPwForm(p=>({...p,newPassword:e.target.value}))}/>
            <Btn onClick={changeCred} full>{t('profile.update')}</Btn>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={onExport} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-center hover:border-green-300 transition active:scale-95">
          <div className="text-2xl mb-1">📤</div>
          <p className="font-semibold text-sm text-gray-700 dark:text-gray-200">{t('profile.export')}</p>
          <p className="text-xs text-gray-400">{t('profile.exportSub')}</p>
        </button>
        <button onClick={onImport} className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 text-center hover:border-blue-300 transition active:scale-95">
          <div className="text-2xl mb-1">📥</div>
          <p className="font-semibold text-sm text-gray-700 dark:text-gray-200">{t('profile.import')}</p>
          <p className="text-xs text-gray-400">{t('profile.importSub')}</p>
        </button>
      </div>
      <button onClick={logout} className="w-full py-4 rounded-2xl border-2 border-red-200 text-red-500 font-bold hover:bg-red-50 transition text-sm active:scale-95">{t('profile.signOut')}</button>
    </div>
  );
}

export default function ClientDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [page, setPage] = useState('home');
  const [selectedFamilyId, setSelectedFamilyId] = useState(null);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [prevPage, setPrevPage] = useState('families');
  const [pFilter, setPFilter] = useState({ risk:'all', visit:'all' });

  const navItems = [
    { id:'home', icon:'📊', label:t('nav.home') },
    { id:'families', icon:'🏠', label:t('nav.families') },
    { id:'patients', icon:'👥', label:t('nav.patients') },
  ];

  const navigate = (pg, filter) => {
    if (pg==='patients'&&filter) {
      if (filter==='missed') setPFilter({risk:'all',visit:'missed'});
      else setPFilter({risk:filter,visit:'all'});
    }
    setPage(pg);
  };

  const openFamily = (id) => { setSelectedFamilyId(id); setPage('family-detail'); };
  const openPatient = (id, from) => { setSelectedPatientId(id); setPrevPage(from||page); setPage('patient-detail'); };

  if (page==='patient-detail'&&selectedPatientId) {
    return <PatientPage patientId={selectedPatientId} onBack={()=>setPage(prevPage==='family-detail'?'family-detail':'patients')} onDeleted={()=>{ if(prevPage==='family-detail') setPage('family-detail'); else setPage('patients'); }}/>;
  }
  if (page==='family-detail'&&selectedFamilyId) {
    return <FamilyPage familyId={selectedFamilyId} onBack={()=>setPage('families')} onPatientSelect={(id)=>openPatient(id,'family-detail')}/>;
  }
  if (page==='export') return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6 pb-8 max-w-2xl mx-auto"><ExportPage onBack={()=>setPage('profile')}/></div>;
  if (page==='import') return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-6 pb-8 max-w-2xl mx-auto"><ImportPage onBack={()=>setPage('profile')} onDone={()=>setPage('patients')}/></div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-gray-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-40 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-red-500 rounded-xl flex items-center justify-center text-lg shadow font-bold select-none">🏥</div>
          <div><p className="font-black text-base leading-tight">PatronageCare</p><p className="text-xs text-gray-400">Home Visit System</p></div>
        </div>
        <button onClick={()=>setPage('profile')} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 transition text-sm font-medium active:scale-95">
          <span className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0">
            {user?.photo_path?<img src={user.photo_path} alt="" className="w-full h-full object-cover"/>:(user?.name||user?.login||'?')[0].toUpperCase()}
          </span>
          <span className="hidden sm:block max-w-28 truncate">{user?.name||user?.login}</span>
        </button>
      </header>
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-5 pb-28">
        {page==='home'     && <HomeDashboard onNavigate={navigate}/>}
        {page==='families' && <FamiliesList onFamilySelect={openFamily}/>}
        {page==='patients' && <PatientsList initialRisk={pFilter.risk} initialVisit={pFilter.visit} onPatientSelect={(id)=>openPatient(id,'patients')}/>}
        {page==='vaccines' && <VaccinesPage onPatientSelect={(id)=>openPatient(id,'vaccines')} onBack={()=>setPage('home')}/>}
        {page==='profile'  && <ProfilePage onExport={()=>setPage('export')} onImport={()=>setPage('import')} onBack={()=>setPage('home')}/>}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-2xl">
        <div className="flex max-w-2xl mx-auto">
          {navItems.map(item=>(
            <button key={item.id} onClick={()=>navigate(item.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-3 transition-all select-none active:scale-95 ${page===item.id||(item.id==='families'&&page==='family-detail')||(item.id==='patients'&&['patient-detail','vaccines'].includes(page))?'text-indigo-600':'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
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
