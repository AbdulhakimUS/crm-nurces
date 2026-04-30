// routes/admin.js
require('dotenv').config();
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const authGuard = require('../middleware/authGuard');
const adminGuard = require('../middleware/adminGuard');
const { getOne, getAll, run } = require('../db/database');

router.use(authGuard, adminGuard);

// GET /api/admin/clients
router.get('/clients', async (req, res) => {
  try {
    const clients = await getAll(
      'SELECT id, login, name, phone, created_at FROM clients ORDER BY created_at DESC'
    );
    return res.json(clients);
  } catch (err) {
    console.error('Ошибка получения клиентов:', err);
    return res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/admin/clients
router.post('/clients',
  [
    body('login').trim().notEmpty().isLength({ min: 3 }).withMessage('Логин минимум 3 символа'),
    body('password').notEmpty().isLength({ min: 6 }).withMessage('Пароль минимум 6 символов'),
    body('name').optional().trim()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { login, password, name } = req.body;
    try {
      const existClient = await getOne('SELECT id FROM clients WHERE login = $1', [login]);
      const existAdmin  = await getOne('SELECT id FROM admins WHERE login = $1', [login]);
      if (existClient || existAdmin) {
        return res.status(409).json({ message: 'Логин уже занят' });
      }

      const hash = await bcrypt.hash(password, 12);
      const result = await run(
        'INSERT INTO clients (login, password_hash, name) VALUES ($1, $2, $3) RETURNING id, login, name, phone, created_at',
        [login, hash, name || null]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Ошибка создания клиента:', err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }
  }
);

// PUT /api/admin/clients/:id
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
    try {
      const client = await getOne('SELECT * FROM clients WHERE id = $1', [id]);
      if (!client) return res.status(404).json({ message: 'Клиент не найден' });

      if (login && login !== client.login) {
        const exist      = await getOne('SELECT id FROM clients WHERE login = $1 AND id != $2', [login, id]);
        const existAdmin = await getOne('SELECT id FROM admins WHERE login = $1', [login]);
        if (exist || existAdmin) return res.status(409).json({ message: 'Логин уже занят' });
      }

      const newLogin = login || client.login;
      const newName  = name !== undefined ? name : client.name;
      const newHash  = password ? await bcrypt.hash(password, 12) : client.password_hash;

      const result = await run(
        'UPDATE clients SET login = $1, password_hash = $2, name = $3 WHERE id = $4 RETURNING id, login, name, phone, created_at',
        [newLogin, newHash, newName, id]
      );
      return res.json(result.rows[0]);
    } catch (err) {
      console.error('Ошибка обновления клиента:', err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }
  }
);

// DELETE /api/admin/clients/:id
router.delete('/clients/:id', async (req, res) => {
  try {
    const client = await getOne('SELECT id FROM clients WHERE id = $1', [req.params.id]);
    if (!client) return res.status(404).json({ message: 'Клиент не найден' });
    await run('DELETE FROM clients WHERE id = $1', [req.params.id]);
    return res.json({ message: 'Клиент удалён успешно' });
  } catch (err) {
    console.error('Ошибка удаления клиента:', err);
    return res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const clients  = await getOne('SELECT COUNT(*) as count FROM clients');
    const patients = await getOne('SELECT COUNT(*) as count FROM patients');
    const progress = await getOne('SELECT COUNT(*) as count FROM progress_records');
    return res.json({
      clients:  parseInt(clients.count),
      patients: parseInt(patients.count),
      progress: parseInt(progress.count)
    });
  } catch (err) {
    console.error('Ошибка статистики:', err);
    return res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// PUT /api/admin/password
router.put('/password',
  [
    body('currentPassword').notEmpty().withMessage('Текущий пароль обязателен'),
    body('newPassword').isLength({ min: 6 }).withMessage('Новый пароль минимум 6 символов')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { currentPassword, newPassword } = req.body;
    try {
      const admin = await getOne('SELECT * FROM admins WHERE id = $1', [req.user.id]);
      const match = await bcrypt.compare(currentPassword, admin.password_hash);
      if (!match) return res.status(401).json({ message: 'Текущий пароль неверен' });

      const newHash = await bcrypt.hash(newPassword, 12);
      await run('UPDATE admins SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);
      return res.json({ message: 'Пароль успешно изменён' });
    } catch (err) {
      console.error('Ошибка смены пароля:', err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }
  }
);

module.exports = router;
