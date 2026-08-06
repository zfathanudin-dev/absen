package com.kebunlog.absensi.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update

@Dao
interface AbsenPendingDao {

    @Insert
    suspend fun tambah(item: AbsenPendingEntity): Long

    @Query("SELECT * FROM absen_pending WHERE sudahTerkirim = 0 ORDER BY dibuatPada ASC")
    suspend fun ambilYangBelumTerkirim(): List<AbsenPendingEntity>

    @Query("SELECT COUNT(*) FROM absen_pending WHERE sudahTerkirim = 0")
    suspend fun jumlahAntrian(): Int

    @Update
    suspend fun update(item: AbsenPendingEntity)

    @Query("DELETE FROM absen_pending WHERE sudahTerkirim = 1")
    suspend fun bersihkanYangSudahTerkirim()
}
