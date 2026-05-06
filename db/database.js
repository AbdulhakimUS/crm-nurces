// db/database.js — инициализация SQLite базы данных
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'vaccine.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    // Включаем WAL-режим для лучшей производительности
    db.pragma('journal_mode = WAL');
    // Включаем поддержку внешних ключей
    db.pragma('foreign_keys = ON');
    initTables();
  }
  return db;
}

function initTables() {
  // Таблица администраторов
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    )
  `);

  // Таблица клиентов (докторов)
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      phone TEXT,
      photo_path TEXT,
      theme TEXT DEFAULT 'light',
      language TEXT DEFAULT 'uz',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Таблица пациентов
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      passport TEXT NOT NULL,
      phone TEXT NOT NULL,
      birth_date TEXT,
      blood_group TEXT,
      registration_date TEXT NOT NULL,
      extra_fields TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Таблица записей прогресса вакцинации
  db.exec(`
    CREATE TABLE IF NOT EXISTS progress_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      vaccine_type TEXT NOT NULL,
      description TEXT NOT NULL,
      photo_path TEXT,
      record_date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

module.exports = { getDb };