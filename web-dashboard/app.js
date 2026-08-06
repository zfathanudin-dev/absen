const API = ''; // kosong = sama origin (server ini juga yang serve dashboard)

// ===== TOAST =====
function toast(teks, tipe = 'info', durasi = 2600){
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast ' + tipe;
  el.textContent = teks;
  wrap.appendChild(el);
  // sembunyikan otomatis setelah beberapa saat
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, durasi);
}

// ===== ANIMASI BACKDROP (partikel + blob yang mengikuti kursor) =====
(function initBackdrop(){
  const cv = document.getElementById('particleCanvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  let W, H, pts = [], raf, mouse = { x: -9999, y: -9999 };

  function resize(){
    W = cv.width = cv.offsetWidth;
    H = cv.height = cv.offsetHeight;
    const n = Math.min(70, Math.floor((W * H) / 22000));
    pts = Array.from({ length: n }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2.2 + 0.8,
      o: Math.random() * 0.5 + 0.25,
    }));
  }

  function step(){
    ctx.clearRect(0, 0, W, H);
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    ctx.fillStyle = 'rgba(27,58,43,0.5)';
    ctx.strokeStyle = dark ? 'rgba(127,169,135,0.35)' : 'rgba(27,58,43,0.14)';
    ctx.lineWidth = 1;

    for (const p of pts){
      p.x += p.vx; p.y += p.vy;
      if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10; if (p.y > H + 10) p.y = -10;
      ctx.globalAlpha = p.o;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();

      // garis dekat kursor
      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      const d = Math.hypot(dx, dy);
      if (d < 150){
        ctx.globalAlpha = (1 - d / 150) * 0.35;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
      }
    }
    // garis antar partikel dekat
    for (let i = 0; i < pts.length; i++){
      for (let j = i + 1; j < pts.length; j++){
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d = Math.hypot(dx, dy);
        if (d < 90){
          ctx.globalAlpha = (1 - d / 90) * 0.14;
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(step);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  resize();
  step();
})();

// ===== LIVE CLOCK =====
(function initClock(){
  const el = document.getElementById('liveClock');
  if (!el) return;
  function tick(){
    const now = new Date();
    const t = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map(n => String(n).padStart(2, '0')).join(':');
    if (el.textContent !== t) el.textContent = t;
  }
  tick();
  setInterval(tick, 1000);
})();

function getToken(){ return localStorage.getItem('token'); }
function setToken(t){ localStorage.setItem('token', t); }
function clearToken(){ localStorage.removeItem('token'); localStorage.removeItem('adminNama'); }

async function apiFetch(path, opts = {}) {
  const headers = opts.headers || {};
  headers['Authorization'] = `Bearer ${getToken()}`;
  if (!(opts.body instanceof FormData) && opts.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, { ...opts, headers });
  if (res.status === 401) { logout(); throw new Error('Sesi berakhir, silakan login lagi'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan');
  return data;
}

function inisial(nama){
  return nama.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
}
function jamSaja(waktuServer){
  if (!waktuServer) return '-';
  return waktuServer.split(' ')[1]?.slice(0,5) || '-';
}

// ===== TAB SWITCHER DENGAN ANIMASI =====
function bukaTab(namaTab){
  document.querySelectorAll('.nav a').forEach(a => a.classList.remove('active'));
  const link = document.querySelector(`.nav a[data-tab="${namaTab}"]`);
  if (link) link.classList.add('active');

  document.querySelectorAll('.tab-content').forEach(t => {
    t.style.display = 'none';
    t.classList.remove('active');
  });
  const panel = document.getElementById('tab' + namaTab.charAt(0).toUpperCase() + namaTab.slice(1));
  if (panel){
    panel.style.display = 'block';
    // force reflow untuk animasi
    panel.offsetHeight;
    panel.classList.add('active');
  }
  closeDrawer();

  const judul = { absensi:'Absensi Harian', lastseen:'Last Seen', review:'Perlu Review', pekerja:'Data Pekerja', area:'Area & Geofence' };
  document.getElementById('judulHalaman').textContent = judul[namaTab];

  // panggil loader tiap tab
  if (namaTab === 'absensi') { muatAbsensi(); muatStatistik(); }
  if (namaTab === 'lastseen') muatLastSeen();
  if (namaTab === 'review') muatReview();
  if (namaTab === 'pekerja') muatPekerja();
  if (namaTab === 'area') muatArea();
}

document.querySelectorAll('.nav a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    bukaTab(link.dataset.tab);
  });
});

function openDrawer(){ document.getElementById('sidebar').classList.add('open'); document.getElementById('overlay').classList.add('show'); }
function closeDrawer(){ document.getElementById('sidebar').classList.remove('open'); document.getElementById('overlay').classList.remove('show'); }

function masukKeApp(){
  document.getElementById('layarLogin').style.display = 'none';
  document.getElementById('appShell').style.display = 'flex';
  document.getElementById('namaAdmin').textContent = localStorage.getItem('adminNama') || '';
  document.getElementById('namaAdminChip').textContent = localStorage.getItem('adminNama') || '';
  document.getElementById('tanggalHariIni').textContent = new Date().toLocaleDateString('id-ID', { weekday:'long', year:'numeric', month:'long', day:'numeric' }).toUpperCase();
  muatSemuaTabAwal();
}

function logout(){
  clearToken();
  document.getElementById('appShell').style.display = 'none';
  document.getElementById('layarLogin').style.display = 'flex';
  toast('Berhasil keluar', 'success');
}

// ===== LOGIN =====
document.getElementById('formLogin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const errBox = document.getElementById('loginError');
  const btn = e.target.querySelector('button');
  errBox.textContent = '';
  btn.disabled = true; btn.textContent = 'Memproses...';
  try {
    const res = await fetch(API + '/api/auth/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login gagal');
    setToken(data.token);
    localStorage.setItem('adminNama', data.admin.username);
    toast('Login berhasil — selamat datang, ' + data.admin.username, 'success');
    masukKeApp();
  } catch (err) {
    errBox.textContent = err.message;
    toast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Masuk';
  }
});

function muatSemuaTabAwal(){ muatStatistik(); muatAbsensi(); }

if (getToken()) masukKeApp();

// ===== SKELETON LOADING =====
function skeletonRows(jumlah = 5){
  return Array.from({ length: jumlah }, () => `
    <tr>
      <td class="worker-cell"><div class="avatar"></div><div><div class="wname"><div class="skeleton-cell" style="width:100px;height:14px;"></div></div><div class="wid"><div class="skeleton-cell" style="width:60px;height:10px;"></div></div></div></td>
      <td class="mono"><div class="skeleton-cell" style="width:44px;height:12px;"></div></td>
      <td class="mono"><div class="skeleton-cell" style="width:60px;height:12px;"></div></td>
      <td><div class="skeleton-cell" style="width:54px;height:16px;"></div></td>
    </tr>
  `).join('');
}

// ===== TAB ABSENSI =====
async function muatStatistik(){
  try {
    const s = await apiFetch('/api/absensi/statistik/hari-ini');
    document.getElementById('statHadir').innerHTML = `${s.hadir} <small>/${s.totalPekerja}</small>`;
    document.getElementById('statBelum').textContent = s.belumAbsen;
    document.getElementById('statReview').textContent = s.review;
    document.getElementById('statRata').textContent = s.rataJamMasuk;
  } catch (e) { console.error(e); }
}

async function muatAbsensi(){
  const tbody = document.getElementById('tbodyAbsensi');
  tbody.innerHTML = skeletonRows(6);
  try {
    const rows = await apiFetch('/api/absensi?limit=50');
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty">Belum ada data absen</td></tr>'; return; }
    tbody.innerHTML = rows.map((r, i) => `
      <tr style="animation-delay:${i * 25}ms">
        <td class="worker-cell"><div class="avatar">${inisial(r.nama)}</div><div><div class="wname">${r.nama}</div><div class="wid">${r.kode}</div></div></td>
        <td class="mono">${jamSaja(r.waktu_server)}</td>
        <td class="mono">${r.cell_id || '-'}${r.selisih_gps_tower_m ? `<br><span style="color:#C1502E;">Δ${(r.selisih_gps_tower_m/1000).toFixed(1)}km</span>` : ''}</td>
        <td><span class="badge ${r.status === 'tervalidasi' ? 'ok' : r.status === 'ditolak' ? 'ditolak' : 'review'}">${r.status.replace('_',' ')}</span></td>
      </tr>
    `).join('');
    toast('Data absensi diperbarui', 'success', 1500);
  } catch (e) { tbody.innerHTML = `<tr><td colspan="4" class="empty">${e.message}</td></tr>`; toast(e.message, 'error'); }
  muatStatistik();
}

// ===== TAB LAST SEEN =====
async function muatLastSeen(){
  const tbody = document.getElementById('tbodyLastseen');
  tbody.innerHTML = skeletonRows(6);
  try {
    const rows = await apiFetch('/api/last-seen');
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty">Belum ada data</td></tr>'; return; }
    tbody.innerHTML = rows.map((r, i) => `
      <tr style="animation-delay:${i * 25}ms">
        <td class="worker-cell"><div class="avatar">${inisial(r.nama)}</div><div><div class="wname">${r.nama}</div><div class="wid">${r.kode}</div></div></td>
        <td class="mono">${r.waktu_server || 'belum pernah'}</td>
        <td class="mono">${r.cell_id || '-'}${r.cell_akurasi_m ? ` <span style="color:#8a9188;">(~${r.cell_akurasi_m}m)</span>` : ''}</td>
        <td class="mono">${r.ip_address || '-'}</td>
      </tr>
    `).join('');
    toast('Data last seen diperbarui', 'success', 1500);
  } catch (e) { tbody.innerHTML = `<tr><td colspan="4" class="empty">${e.message}</td></tr>`; toast(e.message, 'error'); }
}

// ===== TAB REVIEW =====
async function muatReview(){
  const box = document.getElementById('listReview');
  box.innerHTML = '<div class="empty" style="padding:14px;">Memuat...</div>';
  try {
    const rows = await apiFetch('/api/absensi/review');
    if (!rows.length) { box.innerHTML = '<div class="empty" style="padding:14px;">Tidak ada entri yang perlu direview 🎉</div>'; return; }
    box.innerHTML = rows.map((r, i) => `
      <div class="review-item" style="animation-delay:${i * 40}ms">
        <div style="display:flex; gap:10px;">
          <div class="stamp-flag">!</div>
          <div><div class="rtext"><b>${r.nama}</b> — ${r.alasan_review || 'perlu ditinjau'}</div>
          <div class="rmeta">${jamSaja(r.waktu_server)} · ${r.cell_id || '-'}</div></div>
        </div>
        <div class="review-actions">
          <button class="btn-terima" onclick="putuskanReview(${r.id}, 'tervalidasi')">Terima</button>
          <button class="btn-tolak" onclick="putuskanReview(${r.id}, 'ditolak')">Tolak</button>
        </div>
      </div>
    `).join('');
    toast('Data review diperbarui', 'success', 1500);
  } catch (e) { box.innerHTML = `<div class="empty" style="padding:14px;">${e.message}</div>`; toast(e.message, 'error'); }
}

async function putuskanReview(id, keputusan){
  try {
    await apiFetch(`/api/absensi/${id}/keputusan`, { method:'PATCH', body: JSON.stringify({ keputusan }) });
    toast(keputusan === 'tervalidasi' ? 'Absensi diterima ✓' : 'Absensi ditolak ✕', keputusan === 'tervalidasi' ? 'success' : 'error');
    muatReview();
    muatStatistik();
    muatAbsensi();
  } catch (e) { toast(e.message, 'error'); }
}

// ===== TAB PEKERJA =====
document.getElementById('formPekerja').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  try {
    await apiFetch('/api/pekerja', { method:'POST', body: JSON.stringify({
      kode: document.getElementById('pkKode').value,
      nama: document.getElementById('pkNama').value,
      pin: document.getElementById('pkPin').value,
    })});
    e.target.reset();
    toast('Pekerja ditambahkan ✓', 'success');
    muatPekerja();
  } catch (err) { toast(err.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Tambah'; }
});

async function muatPekerja(){
  const tbody = document.getElementById('tbodyPekerja');
  tbody.innerHTML = skeletonRows(5);
  try {
    const rows = await apiFetch('/api/pekerja');
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty">Belum ada pekerja</td></tr>'; return; }
    tbody.innerHTML = rows.map((r, i) => `
      <tr style="animation-delay:${i * 25}ms">
        <td class="mono">${r.kode}</td>
        <td class="wname">${r.nama}</td>
        <td>${r.aktif ? '<span class="badge ok">Aktif</span>' : '<span class="badge ditolak">Nonaktif</span>'}</td>
        <td>${r.aktif ? `<button class="btn-mini" onclick="nonaktifkanPekerja(${r.id})">Nonaktifkan</button>` : ''}</td>
      </tr>
    `).join('');
    toast('Data pekerja diperbarui', 'success', 1500);
  } catch (e) { tbody.innerHTML = `<tr><td colspan="4" class="empty">${e.message}</td></tr>`; toast(e.message, 'error'); }
}

async function nonaktifkanPekerja(id){
  if (!confirm('Nonaktifkan pekerja ini?')) return;
  try { await apiFetch(`/api/pekerja/${id}/nonaktifkan`, { method:'PATCH' }); toast('Pekerja dinonaktifkan', 'success'); muatPekerja(); }
  catch (e) { toast(e.message, 'error'); }
}

// ===== TAB AREA =====
document.getElementById('formArea').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  try {
    await apiFetch('/api/area', { method:'POST', body: JSON.stringify({
      nama: document.getElementById('arNama').value,
      lat: parseFloat(document.getElementById('arLat').value),
      lng: parseFloat(document.getElementById('arLng').value),
      radius_m: parseInt(document.getElementById('arRadius').value),
    })});
    e.target.reset();
    document.getElementById('arRadius').value = 300;
    toast('Area ditambahkan ✓', 'success');
    muatArea();
  } catch (err) { toast(err.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Tambah'; }
});

async function muatArea(){
  const tbody = document.getElementById('tbodyArea');
  tbody.innerHTML = skeletonRows(5);
  try {
    const rows = await apiFetch('/api/area');
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty">Belum ada area kerja</td></tr>'; return; }
    tbody.innerHTML = rows.map((r, i) => `
      <tr style="animation-delay:${i * 25}ms">
        <td class="wname">${r.nama}</td>
        <td class="mono">${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}</td>
        <td class="mono">${r.radius_m}m</td>
        <td><button class="btn-mini" onclick="hapusArea(${r.id})">Hapus</button></td>
      </tr>
    `).join('');
    toast('Data area diperbarui', 'success', 1500);
  } catch (e) { tbody.innerHTML = `<tr><td colspan="4" class="empty">${e.message}</td></tr>`; toast(e.message, 'error'); }
}

async function hapusArea(id){
  if (!confirm('Hapus area ini?')) return;
  try { await apiFetch(`/api/area/${id}`, { method:'DELETE' }); toast('Area dihapus', 'success'); muatArea(); }
  catch (e) { toast(e.message, 'error'); }
}
