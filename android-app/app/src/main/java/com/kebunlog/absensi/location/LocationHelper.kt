package com.kebunlog.absensi.location

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import com.google.android.gms.location.CurrentLocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

data class HasilLokasi(val lat: Double, val lng: Double, val isMockLocation: Boolean)

class LocationHelper(private val context: Context) {

    private val fusedClient = LocationServices.getFusedLocationProviderClient(context)

    /**
     * Ambil lokasi GPS terkini sekali panggil (bukan langganan berkelanjutan).
     * Dipanggil hanya saat tombol absen ditekan atau app onResume - BUKAN background service,
     * sesuai batasan di konsep sistem (tidak butuh ACCESS_BACKGROUND_LOCATION).
     */
    @SuppressLint("MissingPermission")
    suspend fun ambilLokasiSaatIni(): HasilLokasi? = suspendCancellableCoroutine { cont ->
        val request = CurrentLocationRequest.Builder()
            .setPriority(Priority.PRIORITY_HIGH_ACCURACY)
            .setMaxUpdateAgeMillis(10_000)
            .build()

        fusedClient.getCurrentLocation(request, null)
            .addOnSuccessListener { loc: Location? ->
                if (loc == null) {
                    cont.resume(null)
                } else {
                    val isMock = deteksiMockLocation(loc)
                    cont.resume(HasilLokasi(loc.latitude, loc.longitude, isMock))
                }
            }
            .addOnFailureListener { cont.resume(null) }
    }

    /**
     * Deteksi dasar fake GPS lewat flag resmi Android.
     * Ini SATU lapis deteksi saja (sesuai konsep: syarat wajib), bukan jaminan 100% anti-cheat -
     * data pendukung (cell tower, IP) dipakai backend untuk cross-check tambahan.
     */
    private fun deteksiMockLocation(location: Location): Boolean {
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            location.isMock
        } else {
            @Suppress("DEPRECATION")
            location.isFromMockProvider
        }
    }
}
