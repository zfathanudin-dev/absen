const API = ''; // kosong = sama origin (server ini juga yang serve dashboard)

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

// ===== LOGIN =====
document.getElementById('formLogin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const errBox = document.getElementById('loginError');
  errBox.textContent = '';
  try {
    const res = await fetch(API + '/api/auth/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login gagal');
    setToken(data.token);
    localStorage.setItem('adminNama', data.admin.username);
    masukKeApp();
  } catch (err) {
    errBox.textContent = err.message;
  }
});

function logout(){
  clearToken();
  document.getElementById('appShell').style.display = 'none';
  document.getElementById('layarLogin').style.display = 'flex';
}

function masukKeApp(){
  document.getElementById('layarLogin').style.display = 'none';
  document.getElementById('appShell').style.display = 'flex';
  document.getElementById('namaAdmin').textContent = localStorage.getItem('adminNama') || '';
  document.getElementById('namaAdminChip').textContent = localStorage.getItem('adminNama') || '';
  document.getElementById('tanggalHariIni').textContent = new Date().toLocaleDateString('id-ID', { weekday:'long', year:'numeric', month:'long', day:'numeric' }).toUpperCase();
  muatSemuaTabAwal();
}

if (getToken()) masukKeApp();

// ===== NAVIGASI TAB =====
document.querySelectorAll('.nav a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.nav a').forEach(a => a.classList.remove('active'));
    link.classList.add('active');
    const tab = link.dataset.tab;
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    const judul = { absensi:'Absensi Harian', lastseen:'Last Seen', review:'Perlu Review', pekerja:'Data Pekerja', area:'Area & Geofence' };
    document.getElementById('judulHalaman').textContent = judul[tab];
    document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).style.display = 'block';
    closeDrawer();
    if (tab === 'absensi') muatAbsensi();
    if (tab === 'lastseen') muatLastSeen();
    if (tab === 'review') muatReview();
    if (tab === 'pekerja') muatPekerja();
    if (tab === 'area') muatArea();
  });
});

function openDrawer(){ document.getElementById('sidebar').classList.add('open'); document.getElementById('overlay').classList.add('show'); }
function closeDrawer(){ document.getElementById('sidebar').classList.remove('open'); document.getElementById('overlay').classList.remove('show'); }

function muatSemuaTabAwal(){ muatStatistik(); muatAbsensi(); }

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
  tbody.innerHTML = '<tr><td colspan="4" class="empty">Memuat...</td></tr>';
  try {
    const rows = await apiFetch('/api/absensi?limit=50');
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty">Belum ada data absen</td></tr>'; return; }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td class="worker-cell"><div class="avatar">${inisial(r.nama)}</div><div><div class="wname">${r.nama}</div><div class="wid">${r.kode}</div></div></td>
        <td class="mono">${jamSaja(r.waktu_server)}</td>
        <td class="mono">${r.cell_id || '-'}${r.selisih_gps_tower_m ? `<br><span style="color:#C1502E;">Δ${(r.selisih_gps_tower_m/1000).toFixed(1)}km</span>` : ''}</td>
        <td><span class="badge ${r.status === 'tervalidasi' ? 'ok' : r.status === 'ditolak' ? 'ditolak' : 'review'}">${r.status.replace('_',' ')}</span></td>
      </tr>
    `).join('');
  } catch (e) { tbody.innerHTML = `<tr><td colspan="4" class="empty">${e.message}</td></tr>`; }
  muatStatistik();
}

// ===== TAB LAST SEEN =====
async function muatLastSeen(){
  const tbody = document.getElementById('tbodyLastseen');
  tbody.innerHTML = '<tr><td colspan="4" class="empty">Memuat...</td></tr>';
  try {
    const rows = await apiFetch('/api/last-seen');
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty">Belum ada data</td></tr>'; return; }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td class="worker-cell"><div class="avatar">${inisial(r.nama)}</div><div><div class="wname">${r.nama}</div><div class="wid">${r.kode}</div></div></td>
        <td class="mono">${r.waktu_server || 'belum pernah'}</td>
        <td class="mono">${r.cell_id || '-'}${r.cell_akurasi_m ? ` <span style="color:#8a9188;">(~${r.cell_akurasi_m}m)</span>` : ''}</td>
        <td class="mono">${r.ip_address || '-'}</td>
      </tr>
    `).join('');
  } catch (e) { tbody.innerHTML = `<tr><td colspan="4" class="empty">${e.message}</td></tr>`; }
}

// ===== TAB REVIEW =====
async function muatReview(){
  const box = document.getElementById('listReview');
  box.innerHTML = '<div class="empty" style="padding:14px;">Memuat...</div>';
  try {
    const rows = await apiFetch('/api/absensi/review');
    if (!rows.length) { box.innerHTML = '<div class="empty" style="padding:14px;">Tidak ada entri yang perlu direview 🎉</div>'; return; }
    box.innerHTML = rows.map(r => `
      <div class="review-item">
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
  } catch (e) { box.innerHTML = `<div class="empty" style="padding:14px;">${e.message}</div>`; }
}

async function putuskanReview(id, keputusan){
  try {
    await apiFetch(`/api/absensi/${id}/keputusan`, { method:'PATCH', body: JSON.stringify({ keputusan }) });
    muatReview();
  } catch (e) { alert(e.message); }
}

// ===== TAB PEKERJA =====
document.getElementById('formPekerja').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await apiFetch('/api/pekerja', { method:'POST', body: JSON.stringify({
      kode: document.getElementById('pkKode').value,
      nama: document.getElementById('pkNama').value,
      pin: document.getElementById('pkPin').value,
    })});
    e.target.reset();
    muatPekerja();
  } catch (err) { alert(err.message); }
});

async function muatPekerja(){
  const tbody = document.getElementById('tbodyPekerja');
  tbody.innerHTML = '<tr><td colspan="4" class="empty">Memuat...</td></tr>';
  try {
    const rows = await apiFetch('/api/pekerja');
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty">Belum ada pekerja</td></tr>'; return; }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td class="mono">${r.kode}</td>
        <td class="wname">${r.nama}</td>
        <td>${r.aktif ? '<span class="badge ok">Aktif</span>' : '<span class="badge ditolak">Nonaktif</span>'}</td>
        <td>${r.aktif ? `<button class="btn-mini" onclick="nonaktifkanPekerja(${r.id})">Nonaktifkan</button>` : ''}</td>
      </tr>
    `).join('');
  } catch (e) { tbody.innerHTML = `<tr><td colspan="4" class="empty">${e.message}</td></tr>`; }
}

async function nonaktifkanPekerja(id){
  if (!confirm('Nonaktifkan pekerja ini?')) return;
  try { await apiFetch(`/api/pekerja/${id}/nonaktifkan`, { method:'PATCH' }); muatPekerja(); }
  catch (e) { alert(e.message); }
}

// ===== TAB AREA =====
document.getElementById('formArea').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await apiFetch('/api/area', { method:'POST', body: JSON.stringify({
      nama: document.getElementById('arNama').value,
      lat: parseFloat(document.getElementById('arLat').value),
      lng: parseFloat(document.getElementById('arLng').value),
      radius_m: parseInt(document.getElementById('arRadius').value),
    })});
    e.target.reset();
    document.getElementById('arRadius').value = 300;
    muatArea();
  } catch (err) { alert(err.message); }
});

async function muatArea(){
  const tbody = document.getElementById('tbodyArea');
  tbody.innerHTML = '<tr><td colspan="4" class="empty">Memuat...</td></tr>';
  try {
    const rows = await apiFetch('/api/area');
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty">Belum ada area kerja</td></tr>'; return; }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td class="wname">${r.nama}</td>
        <td class="mono">${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}</td>
        <td class="mono">${r.radius_m}m</td>
        <td><button class="btn-mini" onclick="hapusArea(${r.id})">Hapus</button></td>
      </tr>
    `).join('');
  } catch (e) { tbody.innerHTML = `<tr><td colspan="4" class="empty">${e.message}</td></tr>`; }
}

async function hapusArea(id){
  if (!confirm('Hapus area ini?')) return;
  try { await apiFetch(`/api/area/${id}`, { method:'DELETE' }); muatArea(); }
  catch (e) { alert(e.message); }
}
