// server.js — главный файл сервера
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

// Инициализируем БД и seed при старте
const { getDb } = require('./db/database');
getDb(); // создаст таблицы

// Автоматически запускаем seed (создаёт admin если не существует)
require('./db/seed');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const clientRoutes = require('./routes/clients');
const patientRoutes = require('./routes/patients');
const progressRoutes = require('./routes/progress');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Безопасность ──────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' } // для статических файлов (фото)
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true, // обязательно для httpOnly cookie
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── Парсинг ───────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ── Статические файлы (загруженные фото) ─────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API маршруты ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/patients/:patientId/progress', progressRoutes);

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Обработка 404 ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: 'Маршрут не найден' });
});

// ── Глобальный обработчик ошибок ──────────────────────────────
app.use((err, req, res, next) => {
  console.error('Необработанная ошибка:', err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'Файл слишком большой. Максимум 5MB.' });
  }
  res.status(500).json({ message: err.message || 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log(`📁 Среда: ${process.env.NODE_ENV || 'development'}`);
});