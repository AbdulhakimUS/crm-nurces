// routes/patients.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authGuard = require('../middleware/authGuard');
const { getOne, getAll, run } = require('../db/database');

router.use(authGuard);

function requireClient(req, res, next) {
  if (req.user.role !== 'client') return res.status(403).json({ message: 'Только для клиентов' });
  next();
}

// GET /api/patients
router.get('/', requireClient, async (req, res) => {
  const { search } = req.query;
  try {
    let patients;
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      patients = await getAll(
        `SELECT id, full_name, passport, phone, birth_date, blood_group, registration_date, created_at
         FROM patients
         WHERE client_id = $1 AND (full_name ILIKE $2 OR passport ILIKE $3)
         ORDER BY created_at DESC`,
        [req.user.id, q, q]
      );
    } else {
      patients = await getAll(
        `SELECT id, full_name, passport, phone, birth_date, blood_group, registration_date, created_at
         FROM patients WHERE client_id = $1 ORDER BY created_at DESC`,
        [req.user.id]
      );
    }
    return res.json(patients);
  } catch (err) {
    console.error('Ошибка получения пациентов:', err);
    return res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/patients
router.post('/',
  requireClient,
  [
    body('full_name').trim().notEmpty().withMessage('ФИО обязательно'),
    body('passport').trim().notEmpty().withMessage('Паспорт обязателен'),
    body('phone').trim().notEmpty().withMessage('Телефон обязателен'),
    body('registration_date').notEmpty().withMessage('Дата регистрации обязательна'),
    body('birth_date').optional().trim(),
    body('blood_group').optional().trim(),
    body('extra_fields').optional()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { full_name, passport, phone, registration_date, birth_date, blood_group, extra_fields } = req.body;
    try {
      const extraJson = JSON.stringify(extra_fields || []);
      const result = await run(
        `INSERT INTO patients (client_id, full_name, passport, phone, birth_date, blood_group, registration_date, extra_fields)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [req.user.id, full_name, passport, phone, birth_date || null, blood_group || null, registration_date, extraJson]
      );
      const patient = result.rows[0];
      patient.extra_fields = JSON.parse(patient.extra_fields || '[]');
      return res.status(201).json(patient);
    } catch (err) {
      console.error('Ошибка создания пациента:', err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }
  }
);

// GET /api/patients/:id
router.get('/:id', requireClient, async (req, res) => {
  try {
    const patient = await getOne(
      'SELECT * FROM patients WHERE id = $1 AND client_id = $2',
      [req.params.id, req.user.id]
    );
    if (!patient) return res.status(404).json({ message: 'Пациент не найден' });
    patient.extra_fields = JSON.parse(patient.extra_fields || '[]');
    return res.json(patient);
  } catch (err) {
    console.error('Ошибка получения пациента:', err);
    return res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// PUT /api/patients/:id
router.put('/:id',
  requireClient,
  [
    body('full_name').optional().trim().notEmpty(),
    body('passport').optional().trim().notEmpty(),
    body('phone').optional().trim().notEmpty(),
    body('registration_date').optional().notEmpty(),
    body('birth_date').optional().trim(),
    body('blood_group').optional().trim(),
    body('extra_fields').optional()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const patient = await getOne(
        'SELECT * FROM patients WHERE id = $1 AND client_id = $2',
        [req.params.id, req.user.id]
      );
      if (!patient) return res.status(404).json({ message: 'Пациент не найден' });

      const { full_name, passport, phone, registration_date, birth_date, blood_group, extra_fields } = req.body;
      const extraJson = extra_fields !== undefined ? JSON.stringify(extra_fields) : patient.extra_fields;

      const result = await run(
        `UPDATE patients SET
          full_name = $1, passport = $2, phone = $3,
          birth_date = $4, blood_group = $5,
          registration_date = $6, extra_fields = $7
         WHERE id = $8 AND client_id = $9 RETURNING *`,
        [
          full_name || patient.full_name,
          passport || patient.passport,
          phone || patient.phone,
          birth_date !== undefined ? birth_date : patient.birth_date,
          blood_group !== undefined ? blood_group : patient.blood_group,
          registration_date || patient.registration_date,
          extraJson,
          req.params.id,
          req.user.id
        ]
      );
      const updated = result.rows[0];
      updated.extra_fields = JSON.parse(updated.extra_fields || '[]');
      return res.json(updated);
    } catch (err) {
      console.error('Ошибка обновления пациента:', err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }
  }
);

// DELETE /api/patients/:id
router.delete('/:id', requireClient, async (req, res) => {
  try {
    const patient = await getOne(
      'SELECT id FROM patients WHERE id = $1 AND client_id = $2',
      [req.params.id, req.user.id]
    );
    if (!patient) return res.status(404).json({ message: 'Пациент не найден' });
    await run('DELETE FROM patients WHERE id = $1', [req.params.id]);
    return res.json({ message: 'Пациент удалён' });
  } catch (err) {
    console.error('Ошибка удаления пациента:', err);
    return res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;
