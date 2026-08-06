// Database SQLite - dipilih karena ringan, tanpa proses server DB terpisah.
// Cocok untuk RDP 2 core / 4GB karena tidak ada overhead daemon MySQL/Postgres.
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'absensi.db'));
db.pragma('journal_mode = WAL'); // lebih tahan terhadap sinyal lemah / tulis bersamaan

db.exec(`
CREATE TABLE IF NOT EXISTS pekerja (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode TEXT UNIQUE NOT NULL,        -- contoh: KB-0142
  nama TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  aktif INTEGER DEFAULT 1,
  dibuat_pada TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS area_kerja (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  radius_m INTEGER NOT NULL DEFAULT 300
);

CREATE TABLE IF NOT EXISTS absensi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pekerja_id INTEGER NOT NULL,
  tipe TEXT NOT NULL,                -- 'masuk' | 'keluar'
  waktu_server TEXT DEFAULT (datetime('now')),  -- WAJIB dari server, bukan device
  lat REAL,
  lng REAL,
  is_mock_location INTEGER DEFAULT 0,
  dalam_radius INTEGER DEFAULT 0,
  cell_mcc TEXT, cell_mnc TEXT, cell_lac TEXT, cell_id TEXT,
  cell_lat REAL, cell_lng REAL, cell_akurasi_m INTEGER, selisih_gps_tower_m INTEGER,
  ip_address TEXT,
  foto_path TEXT,
  status TEXT DEFAULT 'tervalidasi', -- 'tervalidasi' | 'perlu_review' | 'ditolak'
  alasan_review TEXT,
  direview_oleh TEXT,
  FOREIGN KEY(pekerja_id) REFERENCES pekerja(id)
);

CREATE TABLE IF NOT EXISTS last_seen (
  pekerja_id INTEGER PRIMARY KEY,
  waktu_server TEXT DEFAULT (datetime('now')),
  cell_mcc TEXT, cell_mnc TEXT, cell_lac TEXT, cell_id TEXT,
  cell_lat REAL, cell_lng REAL, cell_akurasi_m INTEGER,
  lat REAL, lng REAL,
  ip_address TEXT,
  FOREIGN KEY(pekerja_id) REFERENCES pekerja(id)
);

CREATE TABLE IF NOT EXISTS admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL
);
`);

// Migrasi aman: kalau db.js ini dijalankan di database lama (dibuat sebelum kolom
// estimasi tower ditambahkan), CREATE TABLE IF NOT EXISTS di atas tidak akan menambah
// kolom baru ke tabel yang sudah ada - jadi ditambahkan manual di sini, aman diulang.
const migrasiKolom = [
  "ALTER TABLE absensi ADD COLUMN cell_lat REAL",
  "ALTER TABLE absensi ADD COLUMN cell_lng REAL",
  "ALTER TABLE absensi ADD COLUMN cell_akurasi_m INTEGER",
  "ALTER TABLE absensi ADD COLUMN selisih_gps_tower_m INTEGER",
  "ALTER TABLE last_seen ADD COLUMN cell_lat REAL",
  "ALTER TABLE last_seen ADD COLUMN cell_lng REAL",
  "ALTER TABLE last_seen ADD COLUMN cell_akurasi_m INTEGER",
];
for (const sql of migrasiKolom) {
  try { db.exec(sql); } catch (e) { /* kolom sudah ada, abaikan */ }
}

module.exports = db;
