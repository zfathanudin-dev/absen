package com.kebunlog.absensi.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Menyimpan token login & info pekerja secara terenkripsi di device.
 * Dipakai supaya pekerja tidak perlu login ulang tiap buka app (penting karena
 * sinyal di kebun sering putus-nyambung).
 */
class SessionManager(context: Context) {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "sesi_absensi_kebun",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun simpanSesi(token: String, id: Int, kode: String, nama: String) {
        prefs.edit()
            .putString("token", token)
            .putInt("pekerja_id", id)
            .putString("kode", kode)
            .putString("nama", nama)
            .apply()
    }

    fun sudahLogin(): Boolean = prefs.getString("token", null) != null
    fun getToken(): String? = prefs.getString("token", null)
    fun getPekerjaId(): Int = prefs.getInt("pekerja_id", -1)
    fun getKode(): String = prefs.getString("kode", "") ?: ""
    fun getNama(): String = prefs.getString("nama", "") ?: ""

    fun logout() = prefs.edit().clear().apply()
}
