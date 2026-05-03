require('dotenv').config();
const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const authGuard = require('../middleware/authGuard');
const { getOne, run } = require('../db/database');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(authGuard);

function clientOnly(req, res, next) {
  if (req.user.role !== 'client') return res.status(403).json({ message: 'Forbidden' });
  next();
}

async function mapWithAI(headers, sampleRows) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fuzzyMap(headers);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `Map these Excel columns to patient fields. Headers: ${JSON.stringify(headers)}. Sample: ${JSON.stringify(sampleRows.slice(0,2))}.
Return ONLY JSON no markdown:
{
  "family_head": "col_or_null",
  "family_address": "col_or_null",
  "family_phone": "col_or_null",
  "full_name": "col_or_null",
  "passport": "col_or_null",
  "birth_date": "col_or_null",
  "blood_group": "col_or_null",
  "risk_category": "col_or_null",
  "height": "col_or_null",
  "weight": "col_or_null",
  "blood_pressure": "col_or_null",
  "notes": "col_or_null"
}`
        }]
      })
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || '{}';
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return fuzzyMap(headers);
  }
}

function fuzzyMap(headers) {
  const rules = {
    family_head:    ['family','oila','семья','head','boss'],
    family_address: ['address','manzil','адрес','location','street'],
    family_phone:   ['family_phone','oila_tel'],
    full_name:      ['name','ism','fio','ФИО','fullname','full_name','patient'],
    passport:       ['passport','pasport','паспорт','id','doc'],
    birth_date:     ['birth','dob','tug','дата','born'],
    blood_group:    ['blood','qon','gruppe','группа'],
    risk_category:  ['risk','xavf','риск','category'],
    height:         ['height','boy','рост','cm'],
    weight:         ['weight','vazn','вес','kg'],
    blood_pressure: ['bp','pressure','qon bosimi','давление'],
    notes:          ['note','comment','заметка','izoh'],
  };
  const m = {};
  for (const [field, keys] of Object.entries(rules)) {
    m[field] = headers.find(h => keys.some(k => h.toLowerCase().includes(k))) || null;
  }
  return m;
}

function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d) ? null : d.toISOString().split('T')[0];
}

// POST /api/import/analyze
router.post('/analyze', clientOnly, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file' });
    const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    if (!rows.length) return res.status(400).json({ message: 'Empty file' });

    const headers = Object.keys(rows[0]);
    const mapping = await mapWithAI(headers, rows);

    res.json({ headers, total_rows: rows.length, sample: rows.slice(0, 3), mapping });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/import/process
router.post('/process', clientOnly, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file' });
    const cid = req.user.id;
    let mapping;
    try { mapping = JSON.parse(req.body.mapping || '{}'); }
    catch { return res.status(400).json({ message: 'Invalid mapping' }); }

    const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });

    const get = (row, field) => {
      const col = mapping[field];
      return col && row[col] !== undefined && row[col] !== '' ? String(row[col]).trim() : null;
    };

    const results = { created_families: 0, created_patients: 0, updated_patients: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      try {
        const fullName = get(row, 'full_name');
        const passport = get(row, 'passport');
        if (!fullName && !passport) { results.skipped++; continue; }

        // Handle family
        let familyId = null;
        const familyHead = get(row, 'family_head');
        if (familyHead) {
          let fam = await getOne('SELECT id FROM families WHERE client_id=$1 AND head_name=$2', [cid, familyHead]);
          if (!fam) {
            const fr = await run(
              'INSERT INTO families (client_id, head_name, address, phone) VALUES ($1,$2,$3,$4) RETURNING id',
              [cid, familyHead, get(row, 'family_address'), get(row, 'family_phone')]
            );
            fam = fr.rows[0];
            results.created_families++;
          }
          familyId = fam.id;
        }

        // Handle patient
        if (passport) {
          const existing = await getOne('SELECT id FROM patients WHERE passport=$1 AND client_id=$2', [passport.toUpperCase(), cid]);
          if (existing) {
            await run(
              `UPDATE patients SET full_name=COALESCE($1,full_name), birth_date=COALESCE($2,birth_date),
               blood_group=COALESCE($3,blood_group), risk_category=COALESCE($4,risk_category),
               height=COALESCE($5,height), weight=COALESCE($6,weight),
               blood_pressure=COALESCE($7,blood_pressure), notes=COALESCE($8,notes),
               family_id=COALESCE($9,family_id) WHERE id=$10`,
              [fullName, parseDate(get(row,'birth_date')), get(row,'blood_group'),
               get(row,'risk_category'), get(row,'height'), get(row,'weight'),
               get(row,'blood_pressure'), get(row,'notes'), familyId, existing.id]
            );
            results.updated_patients++;
          } else {
            await run(
              `INSERT INTO patients (client_id,family_id,full_name,passport,birth_date,blood_group,risk_category,height,weight,blood_pressure,notes)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
              [cid, familyId, fullName||`Row ${rowNum}`, passport.toUpperCase(),
               parseDate(get(row,'birth_date')), get(row,'blood_group'),
               get(row,'risk_category')||'normal', get(row,'height'),
               get(row,'weight'), get(row,'blood_pressure'), get(row,'notes')]
            );
            results.created_patients++;
          }
        }
      } catch (e) {
        results.errors.push({ row: rowNum, error: e.message.slice(0, 100) });
        results.skipped++;
      }
    }

    res.json({ message: 'Import complete', results });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
