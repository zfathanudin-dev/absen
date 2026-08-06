package com.kebunlog.absensi.data

data class LoginRequest(val kode: String, val pin: String)

data class PekerjaInfo(val id: Int, val kode: String, val nama: String)
data class LoginResponse(val token: String, val pekerja: PekerjaInfo)

data class LastSeenRequest(
    val lat: Double?,
    val lng: Double?,
    val cell_mcc: String?,
    val cell_mnc: String?,
    val cell_lac: String?,
    val cell_id: String?
)

data class RiwayatItem(
    val tipe: String,
    val waktu_server: String?,
    val cell_id: String?,
    val status: String
)

data class TowerSayaResponse(
    val cell_mcc: String? = null,
    val cell_mnc: String? = null,
    val cell_lac: String? = null,
    val cell_id: String? = null,
    val cell_akurasi_m: Int? = null,
    val waktu_server: String? = null
)

data class AbsenResponse(
    val id: Int?,
    val status: String,
    val waktu_server: String?,
    val pesan: String?,
    val error: String?
)
