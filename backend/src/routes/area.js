const express = require('express');
const db = require('../db');
const { butuhLoginAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', butuhLoginAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM area_kerja').all());
});

router.post('/', butuhLoginAdmin, (req, res) => {
  const { nama, lat, lng, radius_m } = req.body;
  if (!nama || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'nama, lat, lng wajib diisi' });
  }
  const info = db.prepare('INSERT INTO area_kerja (nama, lat, lng, radius_m) VALUES (?, ?, ?, ?)')
    .run(nama, lat, lng, radius_m || process.env.DEFAULT_GEOFENCE_RADIUS_M || 300);
  res.json({ id: info.lastInsertRowid });
});

router.delete('/:id', butuhLoginAdmin, (req, res) => {
  db.prepare('DELETE FROM area_kerja WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
