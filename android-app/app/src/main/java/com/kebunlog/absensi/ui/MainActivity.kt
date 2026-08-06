package com.kebunlog.absensi.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.View
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.kebunlog.absensi.R
import com.kebunlog.absensi.data.*
import com.kebunlog.absensi.location.CellTowerHelper
import com.kebunlog.absensi.location.InfoCellTower
import com.kebunlog.absensi.location.LocationHelper
import com.kebunlog.absensi.location.HasilLokasi
import com.kebunlog.absensi.sync.SyncWorker
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {

    private lateinit var session: SessionManager
    private lateinit var locationHelper: LocationHelper
    private lateinit var cellTowerHelper: CellTowerHelper
    private lateinit var db: AppDatabase

    private lateinit var layarAbsensi: View
    private lateinit var layarTower: View
    private lateinit var layarProfil: View

    private val izinPeta = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { hasil ->
        if (hasil.values.all { it }) autoDetectTower()
        else Toast.makeText(this, "Izin lokasi & telepon dibutuhkan untuk absen", Toast.LENGTH_LONG).show()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        session = SessionManager(this)
        locationHelper = LocationHelper(this)
        cellTowerHelper = CellTowerHelper(this)
        db = AppDatabase.getInstance(this)

        layarAbsensi = findViewById(R.id.layarAbsensi)
        layarTower = findViewById(R.id.layarTower)
        layarProfil = findViewById(R.id.layarProfil)

        setupHeaderStatis()
        setupBottomNav()
        setupTombolAbsen()

        findViewById<View>(R.id.btnLogout).setOnClickListener {
            session.logout()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }

        mintaIzinJikaPerlu()
        muatRiwayat()
    }

    override fun onResume() {
        super.onResume()
        if (semuaIzinSudahAda()) autoDetectTower()
        perbaruiTampilanAntrian()
        perbaruiJamTanggal()
    }

    // ===================== SETUP TAMPILAN AWAL =====================

    private fun setupHeaderStatis() {
        findViewById<TextView>(R.id.tvEyebrowAbsensi).text = "${session.getKode()} · KEBUN"
        findViewById<TextView>(R.id.tvNamaPekerja).text = session.getNama()
        perbaruiJamTanggal()

        // Header include di layar Tower & Profil (id anak sama, jadi harus discope lewat root include)
        layarTower.findViewById<TextView>(R.id.tvHdrEyebrow).text = "DETEKSI JARINGAN"
        layarTower.findViewById<TextView>(R.id.tvHdrTitle).text = "Info Tower"
        layarProfil.findViewById<TextView>(R.id.tvHdrEyebrow).text = "AKUN PEKERJA"
        layarProfil.findViewById<TextView>(R.id.tvHdrTitle).text = "Profil"

        val nama = session.getNama()
        val inisial = nama.split(" ").filter { it.isNotBlank() }.take(2).joinToString("") { it.first().uppercase() }
        findViewById<TextView>(R.id.tvAvatarInisial).text = inisial
        findViewById<TextView>(R.id.tvProfilNama).text = nama
        findViewById<TextView>(R.id.tvProfilId).text = "ID ${session.getKode()}"
    }

    private fun perbaruiJamTanggal() {
        val locale = Locale("id", "ID")
        findViewById<TextView>(R.id.tvJamSekarang).text = SimpleDateFormat("HH:mm", locale).format(Date())
        findViewById<TextView>(R.id.tvTanggalSekarang).text = SimpleDateFormat("EEE, d MMM yyyy", locale).format(Date())
    }

    private fun setupBottomNav() {
        findViewById<View>(R.id.navAbsensi).setOnClickListener { tampilkanLayar(layarAbsensi) }
        findViewById<View>(R.id.navTower).setOnClickListener {
            tampilkanLayar(layarTower)
            muatInfoTower()
        }
        findViewById<View>(R.id.navProfil).setOnClickListener { tampilkanLayar(layarProfil) }
    }

    private fun tampilkanLayar(target: View) {
        listOf(layarAbsensi, layarTower, layarProfil).forEach { it.visibility = if (it == target) View.VISIBLE else View.GONE }

        val aktif = ContextCompat.getColor(this, R.color.ink)
        val nonaktif = ContextCompat.getColor(this, R.color.gray_soft)
        findViewById<TextView>(R.id.glyphNavAbsensi).setTextColor(if (target == layarAbsensi) aktif else nonaktif)
        findViewById<TextView>(R.id.glyphNavTower).setTextColor(if (target == layarTower) aktif else nonaktif)
        findViewById<TextView>(R.id.glyphNavProfil).setTextColor(if (target == layarProfil) aktif else nonaktif)
        findViewById<TextView>(R.id.txtNavTower).setTextColor(if (target == layarTower) aktif else nonaktif)
        findViewById<TextView>(R.id.txtNavProfil).setTextColor(if (target == layarProfil) aktif else nonaktif)
    }

    // ===================== IZIN & AUTO-DETECT TOWER =====================

    private fun semuaIzinSudahAda(): Boolean {
        val izinDibutuhkan = arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.READ_PHONE_STATE)
        return izinDibutuhkan.all { ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED }
    }

    private fun mintaIzinJikaPerlu() {
        if (!semuaIzinSudahAda()) {
            izinPeta.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.READ_PHONE_STATE))
        } else {
            autoDetectTower()
        }
    }

    /** Baca tower + kirim sebagai "last seen" ke server - dipanggil tiap app dibuka/resume. */
    private fun autoDetectTower() {
        val info = cellTowerHelper.bacaCellTowerAktif()
        // 1) Kirim tower sekarang juga - "last seen" tower ter-update begitu app dibuka
        kirimLastSeen(info, null)

        // 2) Ambil GPS paralel; kalau dapat, kirim ulang dengan koordinat (server upsert per pekerja)
        lifecycleScope.launch {
            val lokasi = try { locationHelper.ambilLokasiSaatIni() } catch (e: Exception) { null }
            if (lokasi != null) kirimLastSeen(info, lokasi)
        }
    }

    /** Kirim last-seen ke server (tower + optional GPS). */
    private fun kirimLastSeen(info: InfoCellTower, lokasi: HasilLokasi?) {
        lifecycleScope.launch {
            try {
                RetrofitClient.api.kirimLastSeen(
                    "Bearer ${session.getToken()}",
                    LastSeenRequest(
                        lat = lokasi?.lat, lng = lokasi?.lng,
                        cell_mcc = info.mcc, cell_mnc = info.mnc, cell_lac = info.lac, cell_id = info.cellId
                    )
                )
            } catch (e: Exception) {
                // Sinyal lemah/tidak ada - last-seen memang cuma indikator, tidak perlu antrian offline
            }
            if (layarTower.visibility == View.VISIBLE) muatInfoTower()
        }
    }

    // ===================== LAYAR TOWER =====================

    private fun muatInfoTower() {
        lifecycleScope.launch {
            try {
                val res = RetrofitClient.api.ambilTowerSaya("Bearer ${session.getToken()}")
                if (res.isSuccessful && res.body() != null) {
                    val t = res.body()!!
                    layarTower.findViewById<TextView>(R.id.tvTowerId).text = t.cell_id?.let { "BTS-$it" } ?: "Belum Terdeteksi"
                    layarTower.findViewById<TextView>(R.id.tvTowerSub).text =
                        t.waktu_server?.let { "Terhubung sejak $it" } ?: "Buka app di area kebun untuk deteksi"
                    findViewById<TextView>(R.id.tvMccMnc).text = if (t.cell_mcc != null) "${t.cell_mcc} / ${t.cell_mnc}" else "-"
                    findViewById<TextView>(R.id.tvLac).text = t.cell_lac ?: "-"
                    findViewById<TextView>(R.id.tvCellId).text = t.cell_id ?: "-"
                    findViewById<TextView>(R.id.tvEstRadius).text = t.cell_akurasi_m?.let { "~${it}m" } ?: "-"
                }
            } catch (e: Exception) {
                layarTower.findViewById<TextView>(R.id.tvTowerSub).text = "Gagal memuat, cek koneksi"
            }
        }
    }

    // ===================== LAYAR ABSENSI =====================

    private fun setupTombolAbsen() {
        findViewById<View>(R.id.btnAbsenMasuk).setOnClickListener { prosesAbsen("masuk") }
        findViewById<View>(R.id.btnAbsenKeluar).setOnClickListener { prosesAbsen("keluar") }
    }

    private fun prosesAbsen(tipe: String) {
        if (!semuaIzinSudahAda()) { mintaIzinJikaPerlu(); return }

        val progress = findViewById<ProgressBar>(R.id.progressAbsen)
        progress.visibility = View.VISIBLE

        lifecycleScope.launch {
            val lokasi = locationHelper.ambilLokasiSaatIni()
            if (lokasi == null) {
                progress.visibility = View.GONE
                Toast.makeText(this@MainActivity, "Gagal ambil lokasi GPS, coba lagi", Toast.LENGTH_LONG).show()
                return@launch
            }

            val info: InfoCellTower = cellTowerHelper.bacaCellTowerAktif()

            try {
                val res = RetrofitClient.api.kirimAbsen(
                    bearer = "Bearer ${session.getToken()}",
                    tipe = okhttp3.RequestBody.create(null, tipe),
                    lat = okhttp3.RequestBody.create(null, lokasi.lat.toString()),
                    lng = okhttp3.RequestBody.create(null, lokasi.lng.toString()),
                    isMock = okhttp3.RequestBody.create(null, lokasi.isMockLocation.toString()),
                    cellMcc = info.mcc?.let { okhttp3.RequestBody.create(null, it) },
                    cellMnc = info.mnc?.let { okhttp3.RequestBody.create(null, it) },
                    cellLac = info.lac?.let { okhttp3.RequestBody.create(null, it) },
                    cellId = info.cellId?.let { okhttp3.RequestBody.create(null, it) },
                    foto = null
                )
                progress.visibility = View.GONE
                if (res.isSuccessful && res.body() != null) {
                    Toast.makeText(this@MainActivity, res.body()!!.pesan ?: "Absen terkirim", Toast.LENGTH_LONG).show()
                    findViewById<TextView>(R.id.tvStatusPill).text = if (tipe == "masuk") "Sudah Absen Masuk" else "Sudah Absen Keluar"
                } else {
                    Toast.makeText(this@MainActivity, "Absen ditolak server, cek data & coba lagi", Toast.LENGTH_LONG).show()
                }
                muatRiwayat()
            } catch (e: Exception) {
                // Sinyal lemah/putus -> simpan lokal, disync otomatis nanti (offline-first)
                db.absenPendingDao().tambah(
                    AbsenPendingEntity(
                        tipe = tipe, lat = lokasi.lat, lng = lokasi.lng, isMockLocation = lokasi.isMockLocation,
                        cellMcc = info.mcc, cellMnc = info.mnc, cellLac = info.lac, cellId = info.cellId, fotoPath = null
                    )
                )
                progress.visibility = View.GONE
                Toast.makeText(this@MainActivity, "Tidak ada sinyal - absen disimpan, akan terkirim otomatis", Toast.LENGTH_LONG).show()
                jadwalkanSync()
            }
            perbaruiTampilanAntrian()
        }
    }

    private fun jadwalkanSync() {
        WorkManager.getInstance(this).enqueue(OneTimeWorkRequestBuilder<SyncWorker>().build())
    }

    private fun perbaruiTampilanAntrian() {
        lifecycleScope.launch {
            val jumlah = db.absenPendingDao().jumlahAntrian()
            findViewById<TextView>(R.id.tvAntrianOffline).text =
                if (jumlah > 0) "⏳ $jumlah absen menunggu sinkronisasi" else ""
            if (jumlah > 0) jadwalkanSync()
        }
    }

    /** Isi bagian "Riwayat Terakhir" di layar Absensi dengan baris sederhana, mirip mockup. */
    private fun muatRiwayat() {
        lifecycleScope.launch {
            try {
                val res = RetrofitClient.api.ambilRiwayatSaya("Bearer ${session.getToken()}")
                val container = findViewById<LinearLayout>(R.id.listRiwayat)
                container.removeAllViews()
                if (!res.isSuccessful || res.body().isNullOrEmpty()) return@launch

                for (item in res.body()!!) {
                    container.addView(buatBarisRiwayat(item))
                }
            } catch (e: Exception) {
                // Tidak ada koneksi - biarkan kosong, bukan error fatal buat pekerja
            }
        }
    }

    private fun buatBarisRiwayat(item: RiwayatItem): View {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = (7 * resources.displayMetrics.density).toInt()
            }
            gravity = android.view.Gravity.CENTER_VERTICAL
            setBackgroundResource(R.drawable.bg_card_bordered)
            val pad = (12 * resources.displayMetrics.density).toInt()
            setPadding(pad, pad, pad, pad)
        }

        val kiri = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        val jam = item.waktu_server?.split(" ")?.getOrNull(1)?.take(5) ?: "-"
        kiri.addView(TextView(this).apply {
            text = item.tipe.replaceFirstChar { it.uppercase() }
            textSize = 11.5f
            setTextColor(ContextCompat.getColor(context, R.color.ink))
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        kiri.addView(TextView(this).apply {
            text = "$jam — ${item.cell_id?.let { "BTS-$it" } ?: "-"}"
            textSize = 10.5f
            typeface = android.graphics.Typeface.MONOSPACE
            setTextColor(ContextCompat.getColor(context, R.color.gray))
        })

        val badge = TextView(this).apply {
            text = item.status.replace('_', ' ').uppercase()
            textSize = 9.5f
            typeface = android.graphics.Typeface.MONOSPACE
            val warna: Int
            val bg: Int
            when (item.status) {
                "tervalidasi" -> { bg = R.drawable.bg_badge_ok; warna = R.color.paper }
                "ditolak" -> { bg = R.drawable.bg_badge_ditolak; warna = R.color.paper }
                else -> { bg = R.drawable.bg_badge_review; warna = R.color.ink }
            }
            setBackgroundResource(bg)
            setTextColor(ContextCompat.getColor(context, warna))
        }

        row.addView(kiri)
        row.addView(badge)
        return row
    }
}
