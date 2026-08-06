const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

// Login pekerja: kode ID + PIN
router.post('/login', (req, res) => {
  const { kode, pin } = req.body;
  if (!kode || !pin) return res.status(400).json({ error: 'kode dan pin wajib diisi' });

  const pekerja = db.prepare('SELECT * FROM pekerja WHERE kode = ? AND aktif = 1').get(kode);
  if (!pekerja) return res.status(401).json({ error: 'Kode pekerja tidak ditemukan' });

  const cocok = bcrypt.compareSync(pin, pekerja.pin_hash);
  if (!cocok) return res.status(401).json({ error: 'PIN salah' });

  const token = jwt.sign(
    { tipe: 'pekerja', id: pekerja.id, kode: pekerja.kode, nama: pekerja.nama },
    process.env.JWT_SECRET,
    { expiresIn: '30d' } // dibuat panjang karena sinyal di kebun sering putus-nyambung
  );

  res.json({ token, pekerja: { id: pekerja.id, kode: pekerja.kode, nama: pekerja.nama } });
});

// Login admin (web dashboard)
router.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username dan password wajib diisi' });

  const admin = db.prepare('SELECT * FROM admin WHERE username = ?').get(username);
  if (!admin) return res.status(401).json({ error: 'Username tidak ditemukan' });

  const cocok = bcrypt.compareSync(password, admin.pass_hash);
  if (!cocok) return res.status(401).json({ error: 'Password salah' });

  const token = jwt.sign(
    { tipe: 'admin', id: admin.id, username: admin.username },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  res.json({ token, admin: { id: admin.id, username: admin.username } });
});

module.exports = router;
