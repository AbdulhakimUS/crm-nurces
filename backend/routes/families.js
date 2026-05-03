const express = require('express');
const router = express.Router();
const authGuard = require('../middleware/authGuard');
const { getOne, getAll, run } = require('../db/database');

router.use(authGuard);
function clientOnly(req, res, next) {
  if (req.user.role !== 'client') return res.status(403).json({ message: 'Forbidden' });
  next();
}

router.get('/', clientOnly, async (req, res) => {
  try {
    const families = await getAll(`
      SELECT f.*, COUNT(DISTINCT p.id) as member_count,
        ARRAY_AGG(DISTINCT p.risk_category) FILTER (WHERE p.risk_category IS NOT NULL AND p.risk_category != 'normal') as risk_categories
      FROM families f
      LEFT JOIN patients p ON p.family_id = f.id
      WHERE f.client_id = $1
      GROUP BY f.id ORDER BY f.created_at DESC
    `, [req.user.id]);
    res.json(families);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:id', clientOnly, async (req, res) => {
  try {
    const family = await getOne('SELECT * FROM families WHERE id=$1 AND client_id=$2', [req.params.id, req.user.id]);
    if (!family) return res.status(404).json({ message: 'Not found' });
    const members = await getAll(`
      SELECT p.*,
        (SELECT visit_date FROM visits WHERE patient_id=p.id ORDER BY visit_date DESC LIMIT 1) as last_visit,
        (SELECT next_visit_date FROM visits WHERE patient_id=p.id ORDER BY created_at DESC LIMIT 1) as next_visit,
        (SELECT next_date FROM vaccines WHERE patient_id=p.id ORDER BY created_at DESC LIMIT 1) as next_vaccine
      FROM patients p WHERE p.family_id=$1 AND p.client_id=$2 ORDER BY p.created_at
    `, [req.params.id, req.user.id]);
    res.json({ family, members });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', clientOnly, async (req, res) => {
  try {
    const { head_name, address, phone } = req.body;
    if (!head_name) return res.status(422).json({ message: 'head_name required' });
    const r = await run(
      'INSERT INTO families (client_id, head_name, address, phone) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.id, head_name, address||null, phone||null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', clientOnly, async (req, res) => {
  try {
    const { head_name, address, phone } = req.body;
    const r = await run(
      'UPDATE families SET head_name=COALESCE($1,head_name), address=COALESCE($2,address), phone=COALESCE($3,phone) WHERE id=$4 AND client_id=$5 RETURNING *',
      [head_name||null, address||null, phone||null, req.params.id, req.user.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', clientOnly, async (req, res) => {
  try {
    const r = await run('DELETE FROM families WHERE id=$1 AND client_id=$2', [req.params.id, req.user.id]);
    if (!r.rowCount) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
