package com.kebunlog.absensi.location

import android.annotation.SuppressLint
import android.content.Context
import android.telephony.TelephonyManager
import android.telephony.cdma.CdmaCellLocation
import android.telephony.gsm.GsmCellLocation

data class InfoCellTower(
    val mcc: String? = null,
    val mnc: String? = null,
    val lac: String? = null,
    val cellId: String? = null
) {
    /** Format ringkas untuk ditampilkan di layar app, mis. "BTS-114" */
    fun label(): String = cellId?.let { "BTS-$it" } ?: "Tidak terdeteksi"
}

class CellTowerHelper(private val context: Context) {

    /**
     * Baca info cell tower aktif. Data ini murni untuk LOG PENDUKUNG (lihat konsep sistem
     * bagian 4) - bukan syarat wajib absen, karena akurasinya cuma level area (ratusan meter-km).
     */
    @SuppressLint("MissingPermission")
    fun bacaCellTowerAktif(): InfoCellTower {
        return try {
            val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
            val networkOperator = tm.networkOperator
            val mcc = if (networkOperator.length >= 3) networkOperator.substring(0, 3) else null
            val mnc = if (networkOperator.length >= 3) networkOperator.substring(3) else null

            @Suppress("DEPRECATION")
            val cellLocation = tm.cellLocation
            when (cellLocation) {
                is GsmCellLocation -> InfoCellTower(
                    mcc = mcc, mnc = mnc,
                    lac = cellLocation.lac.toString(),
                    cellId = cellLocation.cid.toString()
                )
                is CdmaCellLocation -> InfoCellTower(
                    mcc = mcc, mnc = mnc,
                    lac = cellLocation.networkId.toString(),
                    cellId = cellLocation.baseStationId.toString()
                )
                else -> InfoCellTower(mcc = mcc, mnc = mnc)
            }
        } catch (e: SecurityException) {
            InfoCellTower() // izin belum diberikan - kembalikan kosong, jangan crash
        }
    }
}
