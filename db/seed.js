// db/seed.js — создание суперадмина при первом запуске
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcrypt');
const { getDb } = require('./database');

async function seed() {
  const db = getDb();
  const adminLogin = 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';

  // Проверяем, есть ли уже суперадмин
  const existing = db.prepare('SELECT id FROM admins WHERE login = ?').get(adminLogin);
  if (existing) {
    console.log('✅ Суперадмин уже существует, пропускаем seed');
    return;
  }

  // Хешируем пароль (saltRounds = 12 для продакшна)
  const hash = await bcrypt.hash(adminPassword, 12);
  db.prepare('INSERT INTO admins (login, password_hash) VALUES (?, ?)').run(adminLogin, hash);

  console.log('✅ Суперадмин создан:');
  console.log(`   Логин: ${adminLogin}`);
  console.log(`   Пароль: ${adminPassword}`);
  console.log('   ⚠️  Смените пароль в продакшне через панель администратора!');
}

seed().catch(console.error);