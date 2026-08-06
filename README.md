# Sistem Absensi Pekerja Kebun

Implementasi dari konsep di `konsep-sistem-absensi-kebun.md`: app Android (GPS + cell tower +
deteksi mock location), backend API, dan web dashboard admin.

## Struktur

```
absensi-kebun/
├── android-app/       # App Android (Kotlin) - dibuild via GitHub Actions, TIDAK perlu Android Studio
├── backend/            # Server API (Node.js + Express + SQLite) - jalan di RDP kamu
├── web-dashboard/       # Dashboard admin (HTML/JS statis) - disajikan oleh backend yang sama
└── .github/workflows/   # Workflow build APK
```

## Penting: pembagian tugas GitHub Actions vs RDP

Ini poin yang sering disalahpahami:

- **GitHub Actions** = tempat *compile* APK. Ia jalan sebentar (beberapa menit), lalu mati. Tidak
  bisa dipakai untuk "menghosting" server yang harus terus menyala.
- **RDP kamu (2c/4GB)** = tempat backend Express beneran *berjalan* 24 jam, karena pekerja perlu
  kirim absen kapan saja.

Jadi alurnya: kamu push kode Android → GitHub Actions compile-in jadi APK → kamu download APK-nya
→ backend + dashboard dijalankan manual (atau via PM2) di RDP.

---

## 1. Setup Backend di RDP (2 core / 4GB)

Server dipilih senagaja ringan: Node.js + Express + **SQLite** (bukan MySQL/Postgres, supaya tidak
ada proses database daemon terpisah yang makan RAM).

```bash
cd backend
npm install --omit=dev
copy .env.example .env      # lalu edit .env, isi JWT_SECRET dengan string acak
node setup-admin.js admin passwordkuat123     # buat akun admin pertama
node server.js
```

Server berjalan di `http://IP-RDP-KAMU:3000` — dashboard admin otomatis ikut ter-serve di URL yang
sama (tidak perlu proses/port terpisah, biar hemat RAM di spek 4GB).

**Supaya server tetap jalan setelah RDP di-disconnect**, pakai [PM2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2
pm2 start server.js --name absensi-kebun
pm2 save
pm2 startup   # ikuti instruksi yang muncul, biar auto-start saat RDP reboot
```

Estimasi pemakaian resource: Node.js + Express + SQLite di beban kecil (puluhan pekerja) biasanya
di bawah 150-200MB RAM — masih longgar di RDP 4GB kamu, asal jangan install Android Studio di
mesin yang sama.

**Buka port 3000** di firewall Windows RDP kamu (Windows Defender Firewall → Inbound Rules) supaya
HP pekerja & browser admin bisa akses dari luar.

---

## 2. Build APK via GitHub Actions (tanpa Android Studio)

1. Push folder `android-app/` ini ke repo GitHub kamu.
2. Buka tab **Actions** di repo → pilih workflow "Build APK Absensi Kebun" → **Run workflow**.
3. Isi `apiBaseUrl` dengan alamat backend kamu, contoh: `http://123.45.67.89:3000/`
   (⚠️ wajib pakai `/` di akhir, dan backend harus bisa diakses dari internet/HP pekerja).
4. Tunggu selesai (~5-8 menit) → download APK dari bagian **Artifacts** di halaman run tersebut.
5. Kirim APK ke HP pekerja (nggak lewat Play Store, jadi mereka perlu izinkan "install dari sumber
   tidak dikenal" saat install).

Workflow-nya ada di `.github/workflows/build-apk.yml` — otomatis jalan tiap ada push ke folder
`android-app/`, atau bisa dipicu manual kapan saja.

---

## 3. Alur pemakaian

- **Admin** buka `http://IP-RDP-KAMU:3000` di browser → login → tambah data pekerja (kode + PIN)
  dan area kerja (lat/lng + radius geofence) dulu di tab terkait.
- **Pekerja** install APK → login pakai kode + PIN yang admin buat → tekan "Absen Masuk"/"Absen
  Keluar".
- Setiap app dibuka, info tower otomatis muncul & terkirim sebagai "Last Seen" (bukan absen resmi).
- Absen yang gagal terkirim (sinyal lemah) otomatis disimpan di HP dan disync ulang saat sinyal
  kembali — lihat `SyncWorker.kt`.

## 4. Estimasi Lokasi Cell Tower (opsional, direkomendasikan)

Backend bisa cross-check GPS pekerja terhadap estimasi lokasi dari tower seluler, lewat
[OpenCellID](https://opencellid.org/register) (gratis, daftar untuk dapat API key):

```bash
# di backend/.env
OPENCELLID_API_KEY=isi-dengan-key-kamu
```

Kalau dikosongkan, fitur ini otomatis dilewati (tidak akan error) - absen tetap jalan normal
hanya berdasarkan GPS + deteksi mock location.

⚠️ Backend butuh **Node.js versi 18 ke atas** (dipakai `fetch` bawaan untuk panggil OpenCellID).
Cek dengan `node -v` di RDP kamu.

## Yang belum diimplementasi (lanjutan dari konsep)

- Peta lokasi absen di dashboard (butuh integrasi Leaflet/Google Maps JS - saat ini koordinat cuma
  ditampilkan sebagai teks)
- Export laporan Excel/PDF
- Deteksi anomali IP (VPN/luar wilayah) - saat ini IP cuma dicatat sebagai log, belum ada logic
  cross-check otomatis (butuh API IP-geolocation pihak ketiga)
- Upload foto selfie di layar app (skeleton kamera belum dipasang di UI, tapi backend & API-nya
  sudah siap terima file)
- Font custom (Big Shoulders Display / IBM Plex) di app Android memakai fallback sistem
  (`sans-serif-black` / `monospace`) supaya build tetap stabil tanpa perlu setup downloadable-fonts
  — kalau mau font persis seperti mockup, tinggal tambahkan file font ke `res/font/` dan reference
  di layout.
