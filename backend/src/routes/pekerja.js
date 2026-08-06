const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { butuhLoginAdmin } = require('../middleware/auth');

const router = express.Router();

// List semua pekerja
router.get('/', butuhLoginAdmin, (req, res) => {
  const rows = db.prepare('SELECT id, kode, nama, aktif, dibuat_pada FROM pekerja ORDER BY nama').all();
  res.json(rows);
});

// Tambah pekerja baru
router.post('/', butuhLoginAdmin, (req, res) => {
  const { kode, nama, pin } = req.body;
  if (!kode || !nama || !pin) return res.status(400).json({ error: 'kode, nama, pin wajib diisi' });

  const pinHash = bcrypt.hashSync(pin, 10);
  try {
    const info = db.prepare('INSERT INTO pekerja (kode, nama, pin_hash) VALUES (?, ?, ?)').run(kode, nama, pinHash);
    res.json({ id: info.lastInsertRowid, kode, nama });
  } catch (e) {
    res.status(400).json({ error: 'Kode pekerja sudah dipakai' });
  }
});

// Nonaktifkan pekerja (bukan hapus, biar riwayat absen tetap ada)
router.patch('/:id/nonaktifkan', butuhLoginAdmin, (req, res) => {
  db.prepare('UPDATE pekerja SET aktif = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Reset PIN pekerja
router.patch('/:id/reset-pin', butuhLoginAdmin, (req, res) => {
  const { pin_baru } = req.body;
  if (!pin_baru) return res.status(400).json({ error: 'pin_baru wajib diisi' });
  db.prepare('UPDATE pekerja SET pin_hash = ? WHERE id = ?').run(bcrypt.hashSync(pin_baru, 10), req.params.id);
  res.json({ ok: true });
});

module.exports = router;
