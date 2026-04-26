// routes/patients.js — маршруты для работы с пациентами
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authGuard = require('../middleware/authGuard');
const { getDb } = require('../db/database');

router.use(authGuard);

// Проверка что пользователь — клиент
function requireClient(req, res, next) {
  if (req.user.role !== 'client') return res.status(403).json({ message: 'Только для клиентов' });
  next();
}

// GET /api/patients — список пациентов с поиском
router.get('/', requireClient, (req, res) => {
  const db = getDb();
  const { search } = req.query;

  try {
    let patients;
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      patients = db.prepare(
        `SELECT id, full_name, passport, phone, birth_date, blood_group, registration_date, created_at
         FROM patients
         WHERE client_id = ? AND (full_name LIKE ? OR passport LIKE ?)
         ORDER BY created_at DESC`
      ).all(req.user.id, q, q);
    } else {
      patients = db.prepare(
        `SELECT id, full_name, passport, phone, birth_date, blood_group, registration_date, created_at
         FROM patients WHERE client_id = ? ORDER BY created_at DESC`
      ).all(req.user.id);
    }
    return res.json(patients);
  } catch (err) {
    console.error('Ошибка получения пациентов:', err);
    return res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/patients — создать пациента
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
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { full_name, passport, phone, registration_date, birth_date, blood_group, extra_fields } = req.body;
    const db = getDb();

    try {
      const extraJson = JSON.stringify(extra_fields || []);

      const result = db.prepare(
        `INSERT INTO patients (client_id, full_name, passport, phone, birth_date, blood_group, registration_date, extra_fields)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(req.user.id, full_name, passport, phone, birth_date || null, blood_group || null, registration_date, extraJson);

      const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(result.lastInsertRowid);
      patient.extra_fields = JSON.parse(patient.extra_fields || '[]');

      return res.status(201).json(patient);
    } catch (err) {
      console.error('Ошибка создания пациента:', err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }
  }
);

// GET /api/patients/:id — данные одного пациента
router.get('/:id', requireClient, (req, res) => {
  const db = getDb();
  try {
    const patient = db.prepare('SELECT * FROM patients WHERE id = ? AND client_id = ?').get(req.params.id, req.user.id);
    if (!patient) return res.status(404).json({ message: 'Пациент не найден' });

    patient.extra_fields = JSON.parse(patient.extra_fields || '[]');
    return res.json(patient);
  } catch (err) {
    console.error('Ошибка получения пациента:', err);
    return res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// PUT /api/patients/:id — обновить данные пациента
router.put('/:id',
  requireClient,
  [
    body('full_name').optional().trim().notEmpty().withMessage('ФИО не может быть пустым'),
    body('passport').optional().trim().notEmpty().withMessage('Паспорт не может быть пустым'),
    body('phone').optional().trim().notEmpty().withMessage('Телефон не может быть пустым'),
    body('registration_date').optional().notEmpty(),
    body('birth_date').optional().trim(),
    body('blood_group').optional().trim(),
    body('extra_fields').optional()
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const db = getDb();
    try {
      const patient = db.prepare('SELECT * FROM patients WHERE id = ? AND client_id = ?').get(req.params.id, req.user.id);
      if (!patient) return res.status(404).json({ message: 'Пациент не найден' });

      const { full_name, passport, phone, registration_date, birth_date, blood_group, extra_fields } = req.body;

      const extraJson = extra_fields !== undefined
        ? JSON.stringify(extra_fields)
        : patient.extra_fields;

      db.prepare(
        `UPDATE patients SET
          full_name = ?, passport = ?, phone = ?,
          birth_date = ?, blood_group = ?,
          registration_date = ?, extra_fields = ?
         WHERE id = ? AND client_id = ?`
      ).run(
        full_name || patient.full_name,
        passport || patient.passport,
        phone || patient.phone,
        birth_date !== undefined ? birth_date : patient.birth_date,
        blood_group !== undefined ? blood_group : patient.blood_group,
        registration_date || patient.registration_date,
        extraJson,
        req.params.id,
        req.user.id
      );

      const updated = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
      updated.extra_fields = JSON.parse(updated.extra_fields || '[]');
      return res.json(updated);
    } catch (err) {
      console.error('Ошибка обновления пациента:', err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }
  }
);

// DELETE /api/patients/:id — удалить пациента
router.delete('/:id', requireClient, (req, res) => {
  const db = getDb();
  try {
    const patient = db.prepare('SELECT id FROM patients WHERE id = ? AND client_id = ?').get(req.params.id, req.user.id);
    if (!patient) return res.status(404).json({ message: 'Пациент не найден' });

    db.prepare('DELETE FROM patients WHERE id = ?').run(req.params.id);
    return res.json({ message: 'Пациент удалён' });
  } catch (err) {
    console.error('Ошибка удаления пациента:', err);
    return res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;