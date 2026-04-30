// routes/clients.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const authGuard = require('../middleware/authGuard');
const { upload, uploadToCloudinary } = require('../middleware/upload');
const { getOne, run } = require('../db/database');

function clientGuard(req, res, next) {
  if (req.user.role !== 'client') return res.status(403).json({ message: 'Только для клиентов' });
  next();
}

router.use(authGuard, clientGuard);

// GET /api/client/profile
router.get('/profile', async (req, res) => {
  try {
    const client = await getOne(
      'SELECT id, login, name, phone, photo_path, theme, language FROM clients WHERE id = $1',
      [req.user.id]
    );
    if (!client) return res.status(404).json({ message: 'Профиль не найден' });
    return res.json(client);
  } catch (err) {
    console.error('Ошибка профиля:', err);
    return res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// PUT /api/client/profile
router.put('/profile',
  [
    body('name').optional().trim(),
    body('phone').optional().trim(),
    body('theme').optional().isIn(['light', 'dark']),
    body('language').optional().isIn(['uz', 'ru', 'en'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, phone, theme, language } = req.body;
    try {
      const client = await getOne('SELECT * FROM clients WHERE id = $1', [req.user.id]);
      const result = await run(
        'UPDATE clients SET name = $1, phone = $2, theme = $3, language = $4 WHERE id = $5 RETURNING id, login, name, phone, photo_path, theme, language',
        [
          name !== undefined ? name : client.name,
          phone !== undefined ? phone : client.phone,
          theme || client.theme,
          language || client.language,
          req.user.id
        ]
      );
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('Ошибка обновления профиля:', err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }
  }
);

// PUT /api/client/profile/photo
router.put('/profile/photo', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Файл не загружен' });
  try {
    const uploaded = await uploadToCloudinary(req.file.buffer);
    const photoPath = uploaded.secure_url;
    await run('UPDATE clients SET photo_path = $1 WHERE id = $2', [photoPath, req.user.id]);
    return res.json({ photo_path: photoPath });
  } catch (err) {
    console.error('Ошибка загрузки фото:', err);
    return res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// PUT /api/client/profile/credentials
router.put('/profile/credentials',
  [
    body('currentPassword').notEmpty().withMessage('Текущий пароль обязателен'),
    body('newLogin').optional().trim().isLength({ min: 3 }).withMessage('Логин минимум 3 символа'),
    body('newPassword').optional().isLength({ min: 6 }).withMessage('Пароль минимум 6 символов')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { currentPassword, newLogin, newPassword } = req.body;
    try {
      const client = await getOne('SELECT * FROM clients WHERE id = $1', [req.user.id]);
      const match = await bcrypt.compare(currentPassword, client.password_hash);
      if (!match) return res.status(401).json({ message: 'Текущий пароль неверен' });

      if (newLogin && newLogin !== client.login) {
        const exist      = await getOne('SELECT id FROM clients WHERE login = $1 AND id != $2', [newLogin, req.user.id]);
        const existAdmin = await getOne('SELECT id FROM admins WHERE login = $1', [newLogin]);
        if (exist || existAdmin) return res.status(409).json({ message: 'Логин уже занят' });
      }

      const updatedLogin = newLogin || client.login;
      const updatedHash  = newPassword ? await bcrypt.hash(newPassword, 12) : client.password_hash;

      await run(
        'UPDATE clients SET login = $1, password_hash = $2 WHERE id = $3',
        [updatedLogin, updatedHash, req.user.id]
      );
      return res.json({ message: 'Данные входа обновлены', login: updatedLogin });
    } catch (err) {
      console.error('Ошибка смены учётных данных:', err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }
  }
);

module.exports = router;
