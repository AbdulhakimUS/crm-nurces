// db/database.js — PostgreSQL подключение
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Тест подключения
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Ошибка подключения к PostgreSQL:', err.message);
  } else {
    console.log('✅ PostgreSQL подключён');
    release();
  }
});

async function initTables() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        login TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        login TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        phone TEXT,
        photo_path TEXT,
        theme TEXT DEFAULT 'light',
        language TEXT DEFAULT 'uz',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        full_name TEXT NOT NULL,
        passport TEXT NOT NULL,
        phone TEXT NOT NULL,
        birth_date TEXT,
        blood_group TEXT,
        registration_date TEXT NOT NULL,
        extra_fields TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS progress_records (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        vaccine_type TEXT NOT NULL,
        description TEXT NOT NULL,
        photo_path TEXT,
        record_date TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Таблицы созданы/проверены');
  } finally {
    client.release();
  }
}

// Хелпер: выполнить запрос
async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

// Хелпер: получить одну строку
async function getOne(sql, params = []) {
  const result = await query(sql, params);
  return result.rows[0] || null;
}

// Хелпер: получить все строки
async function getAll(sql, params = []) {
  const result = await query(sql, params);
  return result.rows;
}

// Хелпер: вставить и вернуть строку
async function run(sql, params = []) {
  const result = await query(sql, params);
  return result;
}

module.exports = { pool, initTables, query, getOne, getAll, run };
