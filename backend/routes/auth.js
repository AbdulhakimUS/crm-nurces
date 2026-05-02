require('dotenv').config();
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { getOne } = require('../db/database');
const authGuard = require('../middleware/authGuard');

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: 'Слишком много попыток. Попробуйте через минуту.' }
});

function generateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '30d'
  });
}

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
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
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { login, password } = req.body;

    try {
      const admin = await getOne('SELECT * FROM admins WHERE login = $1', [login]);
      if (admin) {
        const match = await bcrypt.compare(password, admin.password_hash);
        if (!match) return res.status(401).json({ message: 'Неверный логин или пароль' });
        const token = generateToken({ id: admin.id, role: 'admin' });
        setAuthCookie(res, token);
        return res.json({ role: 'admin', id: admin.id, login: admin.login, token });
      }

      const client = await getOne('SELECT * FROM clients WHERE login = $1', [login]);
      if (client) {
        const match = await bcrypt.compare(password, client.password_hash);
        if (!match) return res.status(401).json({ message: 'Неверный логин или пароль' });
        const token = generateToken({ id: client.id, role: 'client' });
        setAuthCookie(res, token);
        return res.json({
          role: 'client',
          id: client.id,
          login: client.login,
          name: client.name,
          theme: client.theme,
          language: client.language,
          photo_path: client.photo_path,
          token
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
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
  return res.json({ message: 'Выход выполнен успешно' });
});

// GET /api/auth/me
router.get('/me', authGuard, async (req, res) => {
  const { id, role } = req.user;
  try {
    if (role === 'admin') {
      const admin = await getOne('SELECT id, login FROM admins WHERE id = $1', [id]);
      if (!admin) return res.status(401).json({ message: 'Пользователь не найден' });
      return res.json({ ...admin, role: 'admin' });
    }
    const client = await getOne(
      'SELECT id, login, name, phone, photo_path, theme, language FROM clients WHERE id = $1',
      [id]
    );
    if (!client) return res.status(401).json({ message: 'Пользователь не найден' });
    return res.json({ ...client, role: 'client' });
  } catch (err) {
    console.error('Ошибка /me:', err);
    return res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
