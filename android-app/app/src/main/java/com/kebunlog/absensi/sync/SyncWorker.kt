package com.kebunlog.absensi.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.kebunlog.absensi.data.AppDatabase
import com.kebunlog.absensi.data.RetrofitClient
import com.kebunlog.absensi.data.SessionManager
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

/**
 * Jalan di background (dijadwalkan oleh WorkManager, otomatis dicoba ulang saat ada koneksi)
 * untuk mengirim absen yang tadinya disimpan lokal karena sinyal lemah/tidak ada.
 * Ini bagian "offline-first" dari kebutuhan fitur di konsep sistem.
 */
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val db = AppDatabase.getInstance(applicationContext)
        val session = SessionManager(applicationContext)
        val token = session.getToken() ?: return Result.success() // belum login, tidak ada yang disync

        val antrian = db.absenPendingDao().ambilYangBelumTerkirim()
        if (antrian.isEmpty()) return Result.success()

        var adaGagal = false
        for (item in antrian) {
            try {
                val fotoPart = item.fotoPath?.let { path ->
                    val file = File(path)
                    if (file.exists()) {
                        MultipartBody.Part.createFormData(
                            "foto", file.name, file.asRequestBody("image/jpeg".toMediaTypeOrNull())
                        )
                    } else null
                }

                val res = RetrofitClient.api.kirimAbsen(
                    bearer = "Bearer $token",
                    tipe = item.tipe.toRequestBody("text/plain".toMediaTypeOrNull()),
                    lat = item.lat.toString().toRequestBody("text/plain".toMediaTypeOrNull()),
                    lng = item.lng.toString().toRequestBody("text/plain".toMediaTypeOrNull()),
                    isMock = item.isMockLocation.toString().toRequestBody("text/plain".toMediaTypeOrNull()),
                    cellMcc = item.cellMcc?.toRequestBody("text/plain".toMediaTypeOrNull()),
                    cellMnc = item.cellMnc?.toRequestBody("text/plain".toMediaTypeOrNull()),
                    cellLac = item.cellLac?.toRequestBody("text/plain".toMediaTypeOrNull()),
                    cellId = item.cellId?.toRequestBody("text/plain".toMediaTypeOrNull()),
                    foto = fotoPart
                )

                if (res.isSuccessful) {
                    db.absenPendingDao().update(item.copy(sudahTerkirim = true))
                } else {
                    adaGagal = true
                }
            } catch (e: Exception) {
                adaGagal = true // biasanya karena masih belum ada koneksi - coba lagi nanti
            }
        }

        db.absenPendingDao().bersihkanYangSudahTerkirim()
        return if (adaGagal) Result.retry() else Result.success()
    }
}
