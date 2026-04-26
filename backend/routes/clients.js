// routes/clients.js — маршруты профиля клиента
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const authGuard = require('../middleware/authGuard');
const { upload, uploadToCloudinary } = require('../middleware/upload');
const { getDb } = require('../db/database');
const path = require('path');
const fs = require('fs');

// Все маршруты требуют авторизацию клиента
function clientGuard(req, res, next) {
  if (req.user.role !== 'client') return res.status(403).json({ message: 'Только для клиентов' });
  next();
}

router.use(authGuard, clientGuard);

// GET /api/client/profile — данные профиля
router.get('/profile', (req, res) => {
  const db = getDb();
  try {
    const client = db.prepare(
      'SELECT id, login, name, phone, photo_path, theme, language FROM clients WHERE id = ?'
    ).get(req.user.id);
    if (!client) return res.status(404).json({ message: 'Профиль не найден' });
    return res.json(client);
  } catch (err) {
    console.error('Ошибка профиля:', err);
    return res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// PUT /api/client/profile — обновить имя, телефон, тему, язык
router.put('/profile',
  [
    body('name').optional().trim(),
    body('phone').optional().trim(),
    body('theme').optional().isIn(['light', 'dark']).withMessage('Тема: light или dark'),
    body('language').optional().isIn(['uz', 'ru', 'en']).withMessage('Язык: uz, ru или en')
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, phone, theme, language } = req.body;
    const db = getDb();

    try {
      const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.user.id);

      db.prepare(
        'UPDATE clients SET name = ?, phone = ?, theme = ?, language = ? WHERE id = ?'
      ).run(
        name !== undefined ? name : client.name,
        phone !== undefined ? phone : client.phone,
        theme || client.theme,
        language || client.language,
        req.user.id
      );

      const updated = db.prepare(
        'SELECT id, login, name, phone, photo_path, theme, language FROM clients WHERE id = ?'
      ).get(req.user.id);

      return res.json(updated);
    } catch (err) {
      console.error('Ошибка обновления профиля:', err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }
  }
);

// PUT /api/client/profile/photo — загрузить фото профиля
router.put('/profile/photo', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Файл не загружен' });

  const db = getDb();
  try {
    // Удаляем старое фото если есть
    const client = db.prepare('SELECT photo_path FROM clients WHERE id = ?').get(req.user.id);
    if (client.photo_path) {
      const oldPath = path.join(__dirname, '..', client.photo_path);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const photoPath = `uploads/${req.file.filename}`;
    db.prepare('UPDATE clients SET photo_path = ? WHERE id = ?').run(photoPath, req.user.id);

    return res.json({ photo_path: photoPath });
  } catch (err) {
    console.error('Ошибка загрузки фото:', err);
    return res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// PUT /api/client/profile/credentials — сменить логин и/или пароль
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
    const db = getDb();

    try {
      const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.user.id);
      const match = await bcrypt.compare(currentPassword, client.password_hash);
      if (!match) return res.status(401).json({ message: 'Текущий пароль неверен' });

      // Проверяем уникальность нового логина
      if (newLogin && newLogin !== client.login) {
        const exist = db.prepare('SELECT id FROM clients WHERE login = ? AND id != ?').get(newLogin, req.user.id);
        const existAdmin = db.prepare('SELECT id FROM admins WHERE login = ?').get(newLogin);
        if (exist || existAdmin) return res.status(409).json({ message: 'Логин уже занят' });
      }

      const updatedLogin = newLogin || client.login;
      const updatedHash = newPassword ? await bcrypt.hash(newPassword, 12) : client.password_hash;

      db.prepare(
        'UPDATE clients SET login = ?, password_hash = ? WHERE id = ?'
      ).run(updatedLogin, updatedHash, req.user.id);

      return res.json({ message: 'Данные входа обновлены', login: updatedLogin });
    } catch (err) {
      console.error('Ошибка смены учётных данных:', err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }
  }
);

module.exports = router;