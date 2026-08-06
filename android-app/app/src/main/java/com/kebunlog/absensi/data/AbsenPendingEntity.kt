package com.kebunlog.absensi.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Antrian absen yang disimpan lokal dulu ketika sinyal lemah/tidak ada (offline-first),
 * lalu disinkronkan ke server oleh SyncWorker begitu ada koneksi.
 */
@Entity(tableName = "absen_pending")
data class AbsenPendingEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val tipe: String,              // "masuk" | "keluar"
    val lat: Double,
    val lng: Double,
    val isMockLocation: Boolean,
    val cellMcc: String?,
    val cellMnc: String?,
    val cellLac: String?,
    val cellId: String?,
    val fotoPath: String?,         // path file lokal, null kalau tanpa selfie
    val dibuatPada: Long = System.currentTimeMillis(),
    val sudahTerkirim: Boolean = false
)
