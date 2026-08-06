package com.kebunlog.absensi.data

import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    @POST("api/auth/login")
    suspend fun login(@Body req: LoginRequest): Response<LoginResponse>

    @POST("api/last-seen")
    suspend fun kirimLastSeen(
        @Header("Authorization") bearer: String,
        @Body req: LastSeenRequest
    ): Response<Map<String, Boolean>>

    @GET("api/last-seen/saya")
    suspend fun ambilTowerSaya(@Header("Authorization") bearer: String): Response<TowerSayaResponse>

    @GET("api/absensi/saya")
    suspend fun ambilRiwayatSaya(@Header("Authorization") bearer: String): Response<List<RiwayatItem>>

    // Multipart karena bisa menyertakan foto selfie opsional
    @Multipart
    @POST("api/absensi")
    suspend fun kirimAbsen(
        @Header("Authorization") bearer: String,
        @Part("tipe") tipe: RequestBody,
        @Part("lat") lat: RequestBody,
        @Part("lng") lng: RequestBody,
        @Part("is_mock_location") isMock: RequestBody,
        @Part("cell_mcc") cellMcc: RequestBody?,
        @Part("cell_mnc") cellMnc: RequestBody?,
        @Part("cell_lac") cellLac: RequestBody?,
        @Part("cell_id") cellId: RequestBody?,
        @Part foto: MultipartBody.Part?
    ): Response<AbsenResponse>
}
