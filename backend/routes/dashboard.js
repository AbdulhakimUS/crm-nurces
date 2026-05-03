const express = require('express');
const router = express.Router();
const authGuard = require('../middleware/authGuard');
const { getAll } = require('../db/database');

router.use(authGuard);
function clientOnly(req, res, next) {
  if (req.user.role !== 'client') return res.status(403).json({ message: 'Forbidden' });
  next();
}

router.get('/stats', clientOnly, async (req, res) => {
  try {
    const cid = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const in30 = new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];

    const [[tp],[tf],[mv],[uv]] = await Promise.all([
      getAll('SELECT COUNT(*) as count FROM patients WHERE client_id=$1', [cid]),
      getAll('SELECT COUNT(*) as count FROM families WHERE client_id=$1', [cid]),
      getAll(`SELECT COUNT(*) as count FROM visits WHERE client_id=$1 AND next_visit_date < $2 AND status != 'completed'`, [cid, today]),
      getAll(`SELECT COUNT(*) as count FROM vaccines WHERE client_id=$1 AND next_date >= $2 AND next_date <= $3`, [cid, today, in30]),
    ]);

    const riskGroups = await getAll(
      `SELECT risk_category, COUNT(*) as count FROM patients WHERE client_id=$1 AND risk_category != 'normal' GROUP BY risk_category`,
      [cid]
    );

    const reminders = await getAll(`
      SELECT p.full_name, 'Visit' as type, v.next_visit_date as due_date
      FROM visits v JOIN patients p ON p.id=v.patient_id
      WHERE v.client_id=$1 AND v.next_visit_date < $2 AND v.status != 'completed'
      UNION ALL
      SELECT p.full_name, vc.vaccine_name as type, vc.next_date as due_date
      FROM vaccines vc JOIN patients p ON p.id=vc.patient_id
      WHERE vc.client_id=$1 AND vc.next_date < $2
      ORDER BY due_date ASC LIMIT 20
    `, [cid, today]);

    res.json({
      total_patients: parseInt(tp.count),
      total_families: parseInt(tf.count),
      missed_visits: parseInt(mv.count),
      upcoming_vaccines: parseInt(uv.count),
      risk_groups: riskGroups,
      reminders,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
