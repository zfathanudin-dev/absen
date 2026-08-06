const express = require('express');
const db = require('../db');
const { estimasiLokasiTower } = require('../celltower');
const { butuhLoginPekerja, butuhLoginAdmin } = require('../middleware/auth');

const router = express.Router();

function ambilIp(req) {
  const xff = req.headers['x-forwarded-for'];
  return (xff ? xff.split(',')[0].trim() : req.socket.remoteAddress) || null;
}

// APP: dipanggil setiap kali app dibuka / kembali ke foreground (onResume)
router.post('/', butuhLoginPekerja, async (req, res) => {
  const { lat, lng, cell_mcc, cell_mnc, cell_lac, cell_id } = req.body;
  const ip = ambilIp(req);

  const estimasiTower = await estimasiLokasiTower({
    mcc: cell_mcc, mnc: cell_mnc, lac: cell_lac, cellId: cell_id,
  });

  db.prepare(`
    INSERT INTO last_seen (pekerja_id, lat, lng, cell_mcc, cell_mnc, cell_lac, cell_id, cell_lat, cell_lng, cell_akurasi_m, ip_address, waktu_server)
    VALUES (@pekerja_id, @lat, @lng, @cell_mcc, @cell_mnc, @cell_lac, @cell_id, @cell_lat, @cell_lng, @cell_akurasi_m, @ip_address, datetime('now'))
    ON CONFLICT(pekerja_id) DO UPDATE SET
      lat=excluded.lat, lng=excluded.lng,
      cell_mcc=excluded.cell_mcc, cell_mnc=excluded.cell_mnc,
      cell_lac=excluded.cell_lac, cell_id=excluded.cell_id,
      cell_lat=excluded.cell_lat, cell_lng=excluded.cell_lng, cell_akurasi_m=excluded.cell_akurasi_m,
      ip_address=excluded.ip_address, waktu_server=datetime('now')
  `).run({
    pekerja_id: req.pekerja.id,
    lat: lat ? parseFloat(lat) : null,
    lng: lng ? parseFloat(lng) : null,
    cell_mcc: cell_mcc || null,
    cell_mnc: cell_mnc || null,
    cell_lac: cell_lac || null,
    cell_id: cell_id || null,
    cell_lat: estimasiTower ? estimasiTower.lat : null,
    cell_lng: estimasiTower ? estimasiTower.lng : null,
    cell_akurasi_m: estimasiTower ? estimasiTower.radius_m : null,
    ip_address: ip,
  });

  res.json({ ok: true, estimasi_radius_m: estimasiTower ? estimasiTower.radius_m : null });
});

// APP: info tower + estimasi lokasi milik pekerja yang sedang login (layar "Tower")
router.get('/saya', butuhLoginPekerja, (req, res) => {
  const row = db.prepare(`
    SELECT cell_mcc, cell_mnc, cell_lac, cell_id, cell_akurasi_m, waktu_server
    FROM last_seen WHERE pekerja_id = ?
  `).get(req.pekerja.id);
  res.json(row || {});
});

// DASHBOARD: kolom "Last Seen" semua pekerja
router.get('/', butuhLoginAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT p.id, p.kode, p.nama, ls.waktu_server, ls.cell_id, ls.cell_akurasi_m, ls.lat, ls.lng, ls.ip_address
    FROM pekerja p LEFT JOIN last_seen ls ON ls.pekerja_id = p.id
    WHERE p.aktif = 1
    ORDER BY ls.waktu_server DESC
  `).all();
  res.json(rows);
});

module.exports = router;
