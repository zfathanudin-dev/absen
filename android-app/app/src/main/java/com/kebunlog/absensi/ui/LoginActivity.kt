package com.kebunlog.absensi.ui

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.kebunlog.absensi.R
import com.kebunlog.absensi.data.LoginRequest
import com.kebunlog.absensi.data.RetrofitClient
import com.kebunlog.absensi.data.SessionManager
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {

    private lateinit var session: SessionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        session = SessionManager(this)

        // Sudah login sebelumnya -> langsung ke MainActivity, tidak perlu login ulang
        if (session.sudahLogin()) {
            bukaMain()
            return
        }

        setContentView(R.layout.activity_login)

        val etKode = findViewById<android.widget.EditText>(R.id.etKode)
        val etPin = findViewById<android.widget.EditText>(R.id.etPin)
        val btnLogin = findViewById<android.widget.Button>(R.id.btnLogin)
        val tvError = findViewById<android.widget.TextView>(R.id.tvErrorLogin)
        val progress = findViewById<android.widget.ProgressBar>(R.id.progressLogin)

        btnLogin.setOnClickListener {
            val kode = etKode.text.toString().trim()
            val pin = etPin.text.toString().trim()
            tvError.text = ""

            if (kode.isEmpty() || pin.isEmpty()) {
                tvError.text = "Kode dan PIN wajib diisi"
                return@setOnClickListener
            }

            progress.visibility = android.view.View.VISIBLE
            btnLogin.isEnabled = false

            lifecycleScope.launch {
                try {
                    val res = RetrofitClient.api.login(LoginRequest(kode, pin))
                    if (res.isSuccessful && res.body() != null) {
                        val body = res.body()!!
                        session.simpanSesi(body.token, body.pekerja.id, body.pekerja.kode, body.pekerja.nama)
                        bukaMain()
                    } else {
                        tvError.text = "Kode atau PIN salah"
                    }
                } catch (e: Exception) {
                    tvError.text = "Gagal terhubung ke server. Cek koneksi internet."
                } finally {
                    progress.visibility = android.view.View.GONE
                    btnLogin.isEnabled = true
                }
            }
        }
    }

    private fun bukaMain() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
