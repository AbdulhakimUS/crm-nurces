// server.js
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const { initTables } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Инициализация БД ──────────────────────────────────────
async function startServer() {
  try {
    await initTables();
    require('./db/seed');
  } catch (err) {
    console.error('❌ Ошибка инициализации БД:', err.message);
    process.exit(1);
  }

  // ── Безопасность ────────────────────────────────────────
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));

  // ── CORS ────────────────────────────────────────────────
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:3000'
  ].filter(Boolean);

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS: origin не разрешён: ' + origin));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // ── Парсинг ─────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // ── Статика ─────────────────────────────────────────────
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // ── Маршруты ────────────────────────────────────────────
  app.use('/api/auth',     require('./routes/auth'));
  app.use('/api/admin',    require('./routes/admin'));
  app.use('/api/client',   require('./routes/clients'));
  app.use('/api/patients', require('./routes/patients'));
  app.use('/api/patients/:patientId/progress', require('./routes/progress'));

  // ── Health check ────────────────────────────────────────
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── 404 ─────────────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).json({ message: 'Маршрут не найден' });
  });

  // ── Глобальный обработчик ошибок ────────────────────────
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
}

startServer();
