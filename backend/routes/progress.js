// routes/progress.js
require('dotenv').config();
const express = require('express');
const router = express.Router({ mergeParams: true });
const { body, validationResult } = require('express-validator');
const authGuard = require('../middleware/authGuard');
const { upload, uploadToCloudinary } = require('../middleware/upload');
const { getOne, getAll, run } = require('../db/database');

router.use(authGuard);

function requireClient(req, res, next) {
  if (req.user.role !== 'client') return res.status(403).json({ message: 'Только для клиентов' });
  next();
}

// Проверяем что пациент принадлежит этому клиенту
async function checkPatientOwner(req, res, next) {
  try {
    const patient = await getOne(
      'SELECT id FROM patients WHERE id = $1 AND client_id = $2',
      [req.params.patientId, req.user.id]
    );
    if (!patient) return res.status(404).json({ message: 'Пациент не найден' });
    next();
  } catch (err) {
    return res.status(500).json({ message: 'Ошибка сервера' });
  }
}

// GET /api/patients/:patientId/progress
router.get('/', requireClient, checkPatientOwner, async (req, res) => {
  try {
    const records = await getAll(
      `SELECT * FROM progress_records
       WHERE patient_id = $1 ORDER BY record_date DESC, created_at DESC`,
      [req.params.patientId]
    );
    return res.json(records);
  } catch (err) {
    console.error('Ошибка получения прогресса:', err);
    return res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/patients/:patientId/progress
router.post('/',
  requireClient,
  checkPatientOwner,
  upload.single('photo'),
  [
    body('title').trim().notEmpty().withMessage('Заголовок обязателен'),
    body('vaccine_type').trim().notEmpty().withMessage('Тип вакцины обязателен'),
    body('description').trim().notEmpty().withMessage('Описание обязательно'),
    body('record_date').notEmpty().withMessage('Дата записи обязательна')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, vaccine_type, description, record_date } = req.body;
    try {
      let photoPath = null;
      if (req.file) {
        const uploaded = await uploadToCloudinary(req.file.buffer);
        photoPath = uploaded.secure_url;
      }

      const result = await run(
        `INSERT INTO progress_records (patient_id, title, vaccine_type, description, photo_path, record_date)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [req.params.patientId, title, vaccine_type, description, photoPath, record_date]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Ошибка создания записи прогресса:', err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }
  }
);

// PUT /api/patients/:patientId/progress/:id
router.put('/:id',
  requireClient,
  checkPatientOwner,
  upload.single('photo'),
  [
    body('title').optional().trim().notEmpty(),
    body('vaccine_type').optional().trim().notEmpty(),
    body('description').optional().trim().notEmpty(),
    body('record_date').optional().notEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const record = await getOne(
        'SELECT * FROM progress_records WHERE id = $1 AND patient_id = $2',
        [req.params.id, req.params.patientId]
      );
      if (!record) return res.status(404).json({ message: 'Запись не найдена' });

      const { title, vaccine_type, description, record_date } = req.body;
      let photoPath = record.photo_path;

      if (req.file) {
        const uploaded = await uploadToCloudinary(req.file.buffer);
        photoPath = uploaded.secure_url;
      }

      const result = await run(
        `UPDATE progress_records SET
          title = $1, vaccine_type = $2, description = $3,
          photo_path = $4, record_date = $5
         WHERE id = $6 AND patient_id = $7 RETURNING *`,
        [
          title || record.title,
          vaccine_type || record.vaccine_type,
          description || record.description,
          photoPath,
          record_date || record.record_date,
          req.params.id,
          req.params.patientId
        ]
      );
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('Ошибка обновления прогресса:', err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }
  }
);

// DELETE /api/patients/:patientId/progress/:id
router.delete('/:id', requireClient, checkPatientOwner, async (req, res) => {
  try {
    const record = await getOne(
      'SELECT id FROM progress_records WHERE id = $1 AND patient_id = $2',
      [req.params.id, req.params.patientId]
    );
    if (!record) return res.status(404).json({ message: 'Запись не найдена' });
    await run('DELETE FROM progress_records WHERE id = $1', [req.params.id]);
    return res.json({ message: 'Запись удалена' });
  } catch (err) {
    console.error('Ошибка удаления прогресса:', err);
    return res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;
