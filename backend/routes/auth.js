// routes/auth.js — аутентификация (логин, логаут, /me)
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { getDb } = require('../db/database');
const authGuard = require('../middleware/authGuard');

// Лимит: не более 10 попыток входа в минуту
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: 'Слишком много попыток входа. Попробуйте через минуту.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Установка JWT cookie
function setAuthCookie(res, payload) {
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '8h'
  });

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    maxAge: 8 * 60 * 60 * 1000 // 8 часов
  });

  return token;
}

// POST /api/auth/login
router.post('/login',
  loginLimiter,
  [
    body('login').trim().notEmpty().withMessage('Логин обязателен'),
    body('password').notEmpty().withMessage('Пароль обязателен')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { login, password } = req.body;
    const db = getDb();

    try {
      // Сначала ищем в таблице admins
      const admin = db.prepare('SELECT * FROM admins WHERE login = ?').get(login);
      if (admin) {
        const match = await bcrypt.compare(password, admin.password_hash);
        if (!match) return res.status(401).json({ message: 'Неверный логин или пароль' });

        setAuthCookie(res, { id: admin.id, role: 'admin' });
        return res.json({ role: 'admin', id: admin.id, login: admin.login });
      }

      // Затем ищем в таблице clients
      const client = db.prepare('SELECT * FROM clients WHERE login = ?').get(login);
      if (client) {
        const match = await bcrypt.compare(password, client.password_hash);
        if (!match) return res.status(401).json({ message: 'Неверный логин или пароль' });

        setAuthCookie(res, { id: client.id, role: 'client' });
        return res.json({
          role: 'client',
          id: client.id,
          login: client.login,
          name: client.name,
          theme: client.theme,
          language: client.language,
          photo_path: client.photo_path
        });
      }

      return res.status(401).json({ message: 'Неверный логин или пароль' });
    } catch (err) {
      console.error('Ошибка при входе:', err);
      return res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
  }
);

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  return res.json({ message: 'Выход выполнен успешно' });
});

// GET /api/auth/me — текущий пользователь
router.get('/me', authGuard, (req, res) => {
  const db = getDb();
  const { id, role } = req.user;

  try {
    if (role === 'admin') {
      const admin = db.prepare('SELECT id, login FROM admins WHERE id = ?').get(id);
      if (!admin) return res.status(401).json({ message: 'Пользователь не найден' });
      return res.json({ ...admin, role: 'admin' });
    }

    const client = db.prepare(
      'SELECT id, login, name, phone, photo_path, theme, language FROM clients WHERE id = ?'
    ).get(id);
    if (!client) return res.status(401).json({ message: 'Пользователь не найден' });
    return res.json({ ...client, role: 'client' });
  } catch (err) {
    console.error('Ошибка /me:', err);
    return res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;