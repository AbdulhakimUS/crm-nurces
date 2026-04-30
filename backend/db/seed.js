// db/seed.js — создание суперадмина при первом запуске
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcrypt');
const { getOne, run } = require('./database');

async function seed() {
  const adminLogin = 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';

  const existing = await getOne('SELECT id FROM admins WHERE login = $1', [adminLogin]);
  if (existing) {
    console.log('✅ Суперадмин уже существует, пропускаем seed');
    return;
  }

  const hash = await bcrypt.hash(adminPassword, 12);
  await run('INSERT INTO admins (login, password_hash) VALUES ($1, $2)', [adminLogin, hash]);

  console.log('✅ Суперадмин создан:');
  console.log(`   Логин: ${adminLogin}`);
  console.log(`   Пароль: ${adminPassword}`);
}

seed().catch(console.error);
