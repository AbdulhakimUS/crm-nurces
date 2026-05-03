require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const { initTables } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await initTables();
    require('./db/seed');
  } catch (err) {
    console.error('❌ DB init error:', err.message);
    process.exit(1);
  }

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  const allowedOrigins = [process.env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'].filter(Boolean);
  app.use(cors({
    origin: (origin, cb) => (!origin || allowedOrigins.includes(origin)) ? cb(null, true) : cb(new Error('CORS blocked')),
    credentials: true,
    methods: ['GET','POST','PUT','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization'],
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  app.use('/api/auth',      require('./routes/auth'));
  app.use('/api/admin',     require('./routes/admin'));
  app.use('/api/client',    require('./routes/clients'));
  app.use('/api/families',  require('./routes/families'));
  app.use('/api/patients',  require('./routes/patients'));
  app.use('/api/dashboard', require('./routes/dashboard'));
  app.use('/api/import',    require('./routes/import'));

  app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

  app.use((req, res) => res.status(404).json({ message: 'Not found' }));
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  });

  app.listen(PORT, () => {
    console.log(`🚀 Server on :${PORT}`);
    console.log(`📁 Env: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer();
