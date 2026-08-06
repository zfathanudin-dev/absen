const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { cekDalamAreaKerja, jarakMeter } = require('../geo');
const { estimasiLokasiTower } = require('../celltower');
const { butuhLoginPekerja, butuhLoginAdmin } = require('../middleware/auth');

const router = express.Router();

const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${req.pekerja.kode}.jpg`),
  }),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB - jaga hemat storage & kuota upload
});

function ambilIp(req) {
  const xff = req.headers['x-forwarded-for'];
  return (xff ? xff.split(',')[0].trim() : req.socket.remoteAddress) || null;
}

// APP: submit absen (masuk/keluar)
router.post('/', butuhLoginPekerja, upload.single('foto'), async (req, res) => {
  const { tipe, lat, lng, is_mock_location, cell_mcc, cell_mnc, cell_lac, cell_id } = req.body;

  if (!tipe || !['masuk', 'keluar'].includes(tipe)) {
    return res.status(400).json({ error: "tipe harus 'masuk' atau 'keluar'" });
  }
  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'lat/lng wajib dikirim' });
  }

  const isMock = is_mock_location === 'true' || is_mock_location === true;
  const semuaArea = db.prepare('SELECT * FROM area_kerja').all();
  const { dalamRadius, jarak } = cekDalamAreaKerja(parseFloat(lat), parseFloat(lng), semuaArea);

  // Syarat WAJIB (lihat konsep validasi): auto-reject kalau mock GPS
  if (isMock) {
    return res.status(422).json({
      error: 'Ditolak: terdeteksi mock location aktif',
      status: 'ditolak',
    });
  }

  // Syarat WAJIB kedua: harus dalam radius area kerja
  let status = 'tervalidasi';
  let alasanReview = null;
  if (!dalamRadius) {
    status = 'ditolak';
    alasanReview = `GPS di luar radius area kerja (jarak terdekat ${jarak ?? '?'}m)`;
  }

  // Data pendukung -> kalau ada red flag, ubah ke "perlu_review" (bukan auto-reject)
  const ip = ambilIp(req);
  // NOTE: deteksi anomali IP (VPN/luar wilayah) bisa ditambah di sini via IP-geolocation
  // service pihak ketiga. Sengaja belum di-hardcode karena butuh API key eksternal.

  // Estimasi lokasi dari cell tower (OpenCellID) sebagai cross-check tambahan terhadap GPS.
  // Kalau OPENCELLID_API_KEY belum diisi di .env, fungsi ini otomatis return null (dilewati).
  const estimasiTower = await estimasiLokasiTower({
    mcc: cell_mcc, mnc: cell_mnc, lac: cell_lac, cellId: cell_id,
  });

  let selisihGpsTower = null;
  if (estimasiTower && status === 'tervalidasi') {
    selisihGpsTower = Math.round(jarakMeter(parseFloat(lat), parseFloat(lng), estimasiTower.lat, estimasiTower.lng));

    // Ambang batas dibuat longgar (default 15km) karena estimasi tower di area kebun/rural
    // bisa meleset cukup jauh - ini cuma sinyal "perlu dicek manual", bukan bukti kecurangan.
    const ambangAnomali = parseInt(process.env.CELL_TOWER_ANOMALI_THRESHOLD_M) || 15000;
    if (selisihGpsTower > ambangAnomali) {
      status = 'perlu_review';
      alasanReview = `GPS berselisih ${(selisihGpsTower / 1000).toFixed(1)}km dari estimasi lokasi tower - perlu dicek manual`;
    }
  }

  const stmt = db.prepare(`
    INSERT INTO absensi
      (pekerja_id, tipe, lat, lng, is_mock_location, dalam_radius,
       cell_mcc, cell_mnc, cell_lac, cell_id, cell_lat, cell_lng, cell_akurasi_m, selisih_gps_tower_m,
       ip_address, foto_path, status, alasan_review)
    VALUES (@pekerja_id, @tipe, @lat, @lng, @is_mock_location, @dalam_radius,
       @cell_mcc, @cell_mnc, @cell_lac, @cell_id, @cell_lat, @cell_lng, @cell_akurasi_m, @selisih_gps_tower_m,
       @ip_address, @foto_path, @status, @alasan_review)
  `);

  const info = stmt.run({
    pekerja_id: req.pekerja.id,
    tipe,
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    is_mock_location: isMock ? 1 : 0,
    dalam_radius: dalamRadius ? 1 : 0,
    cell_mcc: cell_mcc || null,
    cell_mnc: cell_mnc || null,
    cell_lac: cell_lac || null,
    cell_id: cell_id || null,
    cell_lat: estimasiTower ? estimasiTower.lat : null,
    cell_lng: estimasiTower ? estimasiTower.lng : null,
    cell_akurasi_m: estimasiTower ? estimasiTower.radius_m : null,
    selisih_gps_tower_m: selisihGpsTower,
    ip_address: ip,
    foto_path: req.file ? req.file.filename : null,
    status,
    alasan_review: alasanReview,
  });

  res.json({
    id: info.lastInsertRowid,
    status,
    waktu_server: new Date().toISOString(), // waktu presisi dikembalikan biar app tahu, TIDAK dipakai sbg sumber
    pesan:
      status === 'ditolak'
        ? alasanReview
        : status === 'perlu_review'
        ? 'Absen tercatat, menunggu review admin'
        : 'Absen berhasil divalidasi',
  });
});

// APP: riwayat absen milik pekerja yang sedang login (buat layar "Riwayat Terakhir" di app)
router.get('/saya', butuhLoginPekerja, (req, res) => {
  const rows = db.prepare(`
    SELECT tipe, waktu_server, cell_id, status
    FROM absensi WHERE pekerja_id = ?
    ORDER BY waktu_server DESC LIMIT 5
  `).all(req.pekerja.id);
  res.json(rows);
});

// DASHBOARD: riwayat absensi + filter
router.get('/', butuhLoginAdmin, (req, res) => {
  const { pekerja_id, tanggal, status, limit } = req.query;
  let sql = `
    SELECT a.*, p.nama, p.kode
    FROM absensi a JOIN pekerja p ON p.id = a.pekerja_id
    WHERE 1=1
  `;
  const params = [];
  if (pekerja_id) { sql += ' AND a.pekerja_id = ?'; params.push(pekerja_id); }
  if (tanggal) { sql += " AND date(a.waktu_server) = ?"; params.push(tanggal); }
  if (status) { sql += ' AND a.status = ?'; params.push(status); }
  sql += ' ORDER BY a.waktu_server DESC LIMIT ?';
  params.push(parseInt(limit) || 100);

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// DASHBOARD: ambil daftar "perlu review"
router.get('/review', butuhLoginAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT a.*, p.nama, p.kode FROM absensi a
    JOIN pekerja p ON p.id = a.pekerja_id
    WHERE a.status = 'perlu_review'
    ORDER BY a.waktu_server DESC
  `).all();
  res.json(rows);
});

// DASHBOARD: approve/reject entri yang perlu_review
router.patch('/:id/keputusan', butuhLoginAdmin, (req, res) => {
  const { keputusan } = req.body; // 'tervalidasi' | 'ditolak'
  if (!['tervalidasi', 'ditolak'].includes(keputusan)) {
    return res.status(400).json({ error: "keputusan harus 'tervalidasi' atau 'ditolak'" });
  }
  db.prepare('UPDATE absensi SET status = ?, direview_oleh = ? WHERE id = ?')
    .run(keputusan, req.admin.username, req.params.id);
  res.json({ ok: true });
});

// DASHBOARD: statistik ringkas untuk header dashboard
router.get('/statistik/hari-ini', butuhLoginAdmin, (req, res) => {
  const totalPekerja = db.prepare('SELECT COUNT(*) c FROM pekerja WHERE aktif = 1').get().c;
  const hadir = db.prepare(`
    SELECT COUNT(DISTINCT pekerja_id) c FROM absensi
    WHERE date(waktu_server) = date('now') AND tipe = 'masuk' AND status != 'ditolak'
  `).get().c;
  const review = db.prepare(`
    SELECT COUNT(*) c FROM absensi WHERE status = 'perlu_review'
  `).get().c;
  const rataJam = db.prepare(`
    SELECT AVG(strftime('%H', waktu_server) * 60 + strftime('%M', waktu_server)) avg_menit
    FROM absensi WHERE date(waktu_server) = date('now') AND tipe = 'masuk'
  `).get().avg_menit;

  let rataJamStr = '-';
  if (rataJam) {
    const jam = Math.floor(rataJam / 60).toString().padStart(2, '0');
    const menit = Math.round(rataJam % 60).toString().padStart(2, '0');
    rataJamStr = `${jam}:${menit}`;
  }

  res.json({ totalPekerja, hadir, belumAbsen: totalPekerja - hadir, review, rataJamMasuk: rataJamStr });
});

module.exports = router;
