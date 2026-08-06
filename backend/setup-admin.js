// Jalankan sekali saja: node setup-admin.js <username> <password>
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./src/db');

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
  console.log('Cara pakai: node setup-admin.js <username> <password>');
  process.exit(1);
}

const passHash = bcrypt.hashSync(password, 10);
try {
  db.prepare('INSERT INTO admin (username, pass_hash) VALUES (?, ?)').run(username, passHash);
  console.log(`Admin "${username}" berhasil dibuat.`);
} catch (e) {
  console.log('Gagal (mungkin username sudah ada):', e.message);
}
