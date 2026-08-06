require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./src/routes/auth');
const absensiRoutes = require('./src/routes/absensi');
const pekerjaRoutes = require('./src/routes/pekerja');
const areaRoutes = require('./src/routes/area');
const lastSeenRoutes = require('./src/routes/lastseen');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Foto selfie absen bisa diakses dashboard lewat /uploads/nama-file.jpg
app.use('/uploads', express.static(process.env.UPLOAD_DIR || './uploads'));

// Web dashboard statis (HTML/JS/CSS) disajikan langsung dari server ini juga,
// jadi cukup 1 proses Node yang jalan di RDP - hemat RAM dibanding 2 proses terpisah.
app.use('/', express.static(path.join(__dirname, '..', 'web-dashboard')));

app.use('/api/auth', authRoutes);
app.use('/api/absensi', absensiRoutes);
app.use('/api/pekerja', pekerjaRoutes);
app.use('/api/area', areaRoutes);
app.use('/api/last-seen', lastSeenRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, waktu: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server absensi kebun jalan di port ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}`);
});
