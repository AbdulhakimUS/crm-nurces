const express = require('express');
const router = express.Router();
const authGuard = require('../middleware/authGuard');
const { getOne, getAll, run } = require('../db/database');

router.use(authGuard);
function clientOnly(req, res, next) {
  if (req.user.role !== 'client') return res.status(403).json({ message: 'Forbidden' });
  next();
}

// GET /api/patients
router.get('/', clientOnly, async (req, res) => {
  try {
    const { search, risk, visit_status } = req.query;
    let where = 'WHERE p.client_id=$1';
    const params = [req.user.id];
    let idx = 2;

    if (search) {
      where += ` AND (p.full_name ILIKE $${idx} OR p.passport ILIKE $${idx})`;
      params.push(`%${search}%`); idx++;
    }
    if (risk && risk !== 'all') {
      where += ` AND p.risk_category=$${idx}`;
      params.push(risk); idx++;
    }
    if (visit_status && visit_status !== 'all') {
      where += ` AND (SELECT status FROM visits WHERE patient_id=p.id ORDER BY created_at DESC LIMIT 1)=$${idx}`;
      params.push(visit_status); idx++;
    }

    const patients = await getAll(`
      SELECT
        p.id, p.client_id, p.family_id, p.full_name, p.passport,
        p.birth_date, p.blood_group, p.risk_category,
        p.height, p.weight, p.blood_pressure, p.notes, p.created_at,
        f.head_name as family_name,
        (SELECT status FROM visits WHERE patient_id=p.id ORDER BY created_at DESC LIMIT 1) as last_visit_status,
        (SELECT next_visit_date FROM visits WHERE patient_id=p.id ORDER BY created_at DESC LIMIT 1) as next_visit_date,
        (SELECT next_date FROM vaccines WHERE patient_id=p.id ORDER BY created_at DESC LIMIT 1) as next_vaccine_date
      FROM patients p
      LEFT JOIN families f ON f.id=p.family_id
      ${where}
      ORDER BY p.created_at DESC
    `, params);

    res.json(patients);
  } catch (err) {
    console.error('patients list error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/patients/:id
router.get('/:id', clientOnly, async (req, res) => {
  try {
    const patient = await getOne(
      `SELECT p.id, p.client_id, p.family_id, p.full_name, p.passport,
        p.birth_date, p.blood_group, p.risk_category,
        p.height, p.weight, p.blood_pressure, p.notes, p.created_at,
        f.head_name as family_name
       FROM patients p
       LEFT JOIN families f ON f.id=p.family_id
       WHERE p.id=$1 AND p.client_id=$2`,
      [req.params.id, req.user.id]
    );
    if (!patient) return res.status(404).json({ message: 'Not found' });

    const [visits, history, vaccines, medications, images] = await Promise.all([
      getAll('SELECT * FROM visits WHERE patient_id=$1 ORDER BY visit_date DESC', [patient.id]),
      getAll('SELECT * FROM visit_history WHERE patient_id=$1 ORDER BY visit_date DESC', [patient.id]),
      getAll('SELECT * FROM vaccines WHERE patient_id=$1 ORDER BY date_given DESC', [patient.id]),
      getAll('SELECT * FROM medications WHERE patient_id=$1 ORDER BY date_given DESC', [patient.id]),
      getAll('SELECT * FROM patient_images WHERE patient_id=$1 ORDER BY created_at DESC', [patient.id]),
    ]);

    res.json({ patient, visits, history, vaccines, medications, images });
  } catch (err) {
    console.error('patient get error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/patients
router.post('/', clientOnly, async (req, res) => {
  try {
    const { family_id, full_name, passport, birth_date, blood_group,
            risk_category, height, weight, blood_pressure, notes } = req.body;
    if (!full_name || !passport) return res.status(422).json({ message: 'full_name and passport required' });

    const r = await run(
      `INSERT INTO patients
        (client_id, family_id, full_name, passport, birth_date, blood_group,
         risk_category, height, weight, blood_pressure, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.user.id, family_id||null, full_name, passport,
       birth_date||null, blood_group||null, risk_category||'normal',
       height||null, weight||null, blood_pressure||null, notes||null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error('patient create error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/patients/:id
router.put('/:id', clientOnly, async (req, res) => {
  try {
    const chk = await getOne('SELECT id FROM patients WHERE id=$1 AND client_id=$2', [req.params.id, req.user.id]);
    if (!chk) return res.status(404).json({ message: 'Not found' });

    const { full_name, passport, birth_date, blood_group, risk_category,
            height, weight, blood_pressure, notes, family_id } = req.body;
    const r = await run(
      `UPDATE patients SET
        full_name=COALESCE($1,full_name), passport=COALESCE($2,passport),
        birth_date=COALESCE($3,birth_date), blood_group=COALESCE($4,blood_group),
        risk_category=COALESCE($5,risk_category), height=COALESCE($6,height),
        weight=COALESCE($7,weight), blood_pressure=COALESCE($8,blood_pressure),
        notes=COALESCE($9,notes), family_id=COALESCE($10::integer,family_id)
       WHERE id=$11 AND client_id=$12 RETURNING *`,
      [full_name||null, passport||null, birth_date||null, blood_group||null,
       risk_category||null, height||null, weight||null, blood_pressure||null,
       notes||null, family_id||null, req.params.id, req.user.id]
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error('patient update error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/patients/:id
router.delete('/:id', clientOnly, async (req, res) => {
  try {
    const r = await run('DELETE FROM patients WHERE id=$1 AND client_id=$2', [req.params.id, req.user.id]);
    if (!r.rowCount) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// VISITS
router.get('/:id/visits', clientOnly, async (req, res) => {
  try { res.json(await getAll('SELECT * FROM visits WHERE patient_id=$1 AND client_id=$2 ORDER BY visit_date DESC', [req.params.id, req.user.id])); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.post('/:id/visits', clientOnly, async (req, res) => {
  try {
    const { visit_date, next_visit_date, status } = req.body;
    const r = await run(
      'INSERT INTO visits (patient_id,client_id,visit_date,next_visit_date,status) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.params.id, req.user.id, visit_date, next_visit_date||null, status||'pending']
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.delete('/:id/visits/:vid', clientOnly, async (req, res) => {
  try { await run('DELETE FROM visits WHERE id=$1 AND client_id=$2', [req.params.vid, req.user.id]); res.json({ message: 'Deleted' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// HISTORY
router.get('/:id/history', clientOnly, async (req, res) => {
  try { res.json(await getAll('SELECT * FROM visit_history WHERE patient_id=$1 AND client_id=$2 ORDER BY visit_date DESC', [req.params.id, req.user.id])); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.post('/:id/history', clientOnly, async (req, res) => {
  try {
    const { visit_date, diagnosis, medication, notes } = req.body;
    const r = await run(
      'INSERT INTO visit_history (patient_id,client_id,visit_date,diagnosis,medication,notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [req.params.id, req.user.id, visit_date, diagnosis||null, medication||null, notes||null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.delete('/:id/history/:hid', clientOnly, async (req, res) => {
  try { await run('DELETE FROM visit_history WHERE id=$1 AND client_id=$2', [req.params.hid, req.user.id]); res.json({ message: 'Deleted' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// VACCINES
router.get('/:id/vaccines', clientOnly, async (req, res) => {
  try { res.json(await getAll('SELECT * FROM vaccines WHERE patient_id=$1 AND client_id=$2 ORDER BY date_given DESC', [req.params.id, req.user.id])); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.post('/:id/vaccines', clientOnly, async (req, res) => {
  try {
    const { vaccine_name, date_given, next_date } = req.body;
    const r = await run(
      'INSERT INTO vaccines (patient_id,client_id,vaccine_name,date_given,next_date) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.params.id, req.user.id, vaccine_name, date_given, next_date||null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.delete('/:id/vaccines/:vid', clientOnly, async (req, res) => {
  try { await run('DELETE FROM vaccines WHERE id=$1 AND client_id=$2', [req.params.vid, req.user.id]); res.json({ message: 'Deleted' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// MEDICATIONS
router.get('/:id/medications', clientOnly, async (req, res) => {
  try { res.json(await getAll('SELECT * FROM medications WHERE patient_id=$1 AND client_id=$2 ORDER BY date_given DESC', [req.params.id, req.user.id])); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.post('/:id/medications', clientOnly, async (req, res) => {
  try {
    const { medicine_name, quantity, times_per_day, duration_days, date_given } = req.body;
    const r = await run(
      'INSERT INTO medications (patient_id,client_id,medicine_name,quantity,times_per_day,duration_days,date_given) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [req.params.id, req.user.id, medicine_name, quantity||null, times_per_day||1, duration_days||1, date_given]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.delete('/:id/medications/:mid', clientOnly, async (req, res) => {
  try { await run('DELETE FROM medications WHERE id=$1 AND client_id=$2', [req.params.mid, req.user.id]); res.json({ message: 'Deleted' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// IMAGES
router.get('/:id/images', clientOnly, async (req, res) => {
  try { res.json(await getAll('SELECT * FROM patient_images WHERE patient_id=$1 AND client_id=$2 ORDER BY created_at DESC', [req.params.id, req.user.id])); }
  catch (err) { res.status(500).json({ message: err.message }); }
});
router.post('/:id/images', clientOnly, async (req, res) => {
  try {
    const { image_url, caption } = req.body;
    const r = await run(
      'INSERT INTO patient_images (patient_id,client_id,image_url,caption) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.id, req.user.id, image_url, caption||null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});
router.delete('/:id/images/:iid', clientOnly, async (req, res) => {
  try { await run('DELETE FROM patient_images WHERE id=$1 AND client_id=$2', [req.params.iid, req.user.id]); res.json({ message: 'Deleted' }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
