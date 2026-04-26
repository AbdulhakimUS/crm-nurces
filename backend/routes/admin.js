// routes/admin.js — маршруты администратора
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const authGuard = require('../middleware/authGuard');
const adminGuard = require('../middleware/adminGuard');
const { getDb } = require('../db/database');

// Все маршруты защищены двойным guard
router.use(authGuard, adminGuard);

// GET /api/admin/clients — список всех клиентов
router.get('/clients', (req, res) => {
  const db = getDb();
  try {
    const clients = db.prepare(
      'SELECT id, login, name, phone, created_at FROM clients ORDER BY created_at DESC'
    ).all();
    return res.json(clients);
  } catch (err) {
    console.error('Ошибка получения клиентов:', err);
    return res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/admin/clients — создать клиента
router.post('/clients',
  [
    body('login').trim().notEmpty().withMessage('Логин обязателен')
      .isLength({ min: 3 }).withMessage('Логин минимум 3 символа'),
    body('password').notEmpty().withMessage('Пароль обязателен')
      .isLength({ min: 6 }).withMessage('Пароль минимум 6 символов'),
    body('name').optional().trim()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { login, password, name } = req.body;
    const db = getDb();

    try {
      // Проверяем уникальность логина среди клиентов и администраторов
      const existClient = db.prepare('SELECT id FROM clients WHERE login = ?').get(login);
      const existAdmin = db.prepare('SELECT id FROM admins WHERE login = ?').get(login);
      if (existClient || existAdmin) {
        return res.status(409).json({ message: 'Логин уже занят' });
      }

      const hash = await bcrypt.hash(password, 12);
      const result = db.prepare(
        'INSERT INTO clients (login, password_hash, name) VALUES (?, ?, ?)'
      ).run(login, hash, name || null);

      const newClient = db.prepare(
        'SELECT id, login, name, phone, created_at FROM clients WHERE id = ?'
      ).get(result.lastInsertRowid);

      return res.status(201).json(newClient);
    } catch (err) {
      console.error('Ошибка создания клиента:', err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }
  }
);

// PUT /api/admin/clients/:id — обновить клиента
router.put('/clients/:id',
  [
    body('login').optional().trim().isLength({ min: 3 }).withMessage('Логин минимум 3 символа'),
    body('password').optional().isLength({ min: 6 }).withMessage('Пароль минимум 6 символов'),
    body('name').optional().trim()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { id } = req.params;
    const { login, password, name } = req.body;
    const db = getDb();

    try {
      const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
      if (!client) return res.status(404).json({ message: 'Клиент не найден' });

      // Проверяем уникальность нового логина
      if (login && login !== client.login) {
        const exist = db.prepare('SELECT id FROM clients WHERE login = ? AND id != ?').get(login, id);
        const existAdmin = db.prepare('SELECT id FROM admins WHERE login = ?').get(login);
        if (exist || existAdmin) return res.status(409).json({ message: 'Логин уже занят' });
      }

      const newLogin = login || client.login;
      const newName = name !== undefined ? name : client.name;
      let newHash = client.password_hash;
      if (password) {
        newHash = await bcrypt.hash(password, 12);
      }

      db.prepare(
        'UPDATE clients SET login = ?, password_hash = ?, name = ? WHERE id = ?'
      ).run(newLogin, newHash, newName, id);

      const updated = db.prepare(
        'SELECT id, login, name, phone, created_at FROM clients WHERE id = ?'
      ).get(id);

      return res.json(updated);
    } catch (err) {
      console.error('Ошибка обновления клиента:', err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }
  }
);

// DELETE /api/admin/clients/:id — удалить клиента (CASCADE удалит всех его пациентов)
router.delete('/clients/:id', (req, res) => {
  const db = getDb();
  try {
    const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
    if (!client) return res.status(404).json({ message: 'Клиент не найден' });

    db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
    return res.json({ message: 'Клиент удалён успешно' });
  } catch (err) {
    console.error('Ошибка удаления клиента:', err);
    return res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// GET /api/admin/stats — статистика
router.get('/stats', (req, res) => {
  const db = getDb();
  try {
    const clientsCount = db.prepare('SELECT COUNT(*) as count FROM clients').get().count;
    const patientsCount = db.prepare('SELECT COUNT(*) as count FROM patients').get().count;
    const progressCount = db.prepare('SELECT COUNT(*) as count FROM progress_records').get().count;
    return res.json({ clients: clientsCount, patients: patientsCount, progress: progressCount });
  } catch (err) {
    console.error('Ошибка статистики:', err);
    return res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// PUT /api/admin/password — сменить пароль суперадмина
router.put('/password',
  [
    body('currentPassword').notEmpty().withMessage('Текущий пароль обязателен'),
    body('newPassword').isLength({ min: 6 }).withMessage('Новый пароль минимум 6 символов')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { currentPassword, newPassword } = req.body;
    const db = getDb();

    try {
      const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.user.id);
      const match = await bcrypt.compare(currentPassword, admin.password_hash);
      if (!match) return res.status(401).json({ message: 'Текущий пароль неверен' });

      const newHash = await bcrypt.hash(newPassword, 12);
      db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);

      return res.json({ message: 'Пароль успешно изменён' });
    } catch (err) {
      console.error('Ошибка смены пароля:', err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }
  }
);

module.exports = router;