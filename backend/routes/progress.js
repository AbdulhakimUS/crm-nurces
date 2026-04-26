// routes/progress.js — маршруты прогресса вакцинации
const express = require('express');
const router = express.Router({ mergeParams: true });
const { body, validationResult } = require('express-validator');
const authGuard = require('../middleware/authGuard');
const upload = require('../middleware/upload');
const { getDb } = require('../db/database');

router.use(authGuard);

// Проверка что пациент принадлежит текущему клиенту
function checkOwnership(req, res) {
  const db = getDb();
  const patient = db.prepare('SELECT id FROM patients WHERE id = ? AND client_id = ?').get(req.params.patientId, req.user.id);
  if (!patient) {
    res.status(404).json({ message: 'Пациент не найден' });
    return null;
  }
  return patient;
}

// GET /api/patients/:patientId/progress
router.get('/', (req, res) => {
  const db = getDb();

  if (req.user.role !== 'client') return res.status(403).json({ message: 'Только для клиентов' });

  try {
    const patient = checkOwnership(req, res);
    if (!patient) return;

    const records = db.prepare(
      `SELECT * FROM progress_records WHERE patient_id = ? ORDER BY record_date DESC, created_at DESC`
    ).all(req.params.patientId);

    return res.json(records);
  } catch (err) {
    console.error('Ошибка получения прогресса:', err);
    return res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/patients/:patientId/progress — добавить запись
router.post('/',
  (req, res, next) => {
    if (req.user.role !== 'client') return res.status(403).json({ message: 'Только для клиентов' });
    next();
  },
  upload.single('photo'),
  [
    body('title').trim().notEmpty().withMessage('Заголовок обязателен'),
    body('vaccine_type').trim().notEmpty().withMessage('Тип вакцины обязателен'),
    body('description').trim().notEmpty().withMessage('Описание обязательно'),
    body('record_date').notEmpty().withMessage('Дата обязательна')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const db = getDb();

    try {
      const patient = checkOwnership(req, res);
      if (!patient) return;

      const { title, vaccine_type, description, record_date } = req.body;
      const photoPath = req.file ? `uploads/${req.file.filename}` : null;

      const result = db.prepare(
        `INSERT INTO progress_records (patient_id, title, vaccine_type, description, photo_path, record_date)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(req.params.patientId, title, vaccine_type, description, photoPath, record_date);

      const record = db.prepare('SELECT * FROM progress_records WHERE id = ?').get(result.lastInsertRowid);
      return res.status(201).json(record);
    } catch (err) {
      console.error('Ошибка добавления прогресса:', err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }
  }
);

module.exports = router;