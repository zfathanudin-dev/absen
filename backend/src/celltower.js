// Estimasi lokasi (lat/lng) dari ID cell tower memakai database publik OpenCellID.
// Ini BUKAN pengganti GPS - akurasinya level ratusan meter s/d beberapa km (tergantung
// kepadatan tower di area tsb). Dipakai sebagai CROSS-CHECK data pendukung terhadap GPS,
// sesuai konsep sistem (bagian data pendukung, bukan syarat wajib validasi absen).
//
// Daftar API key gratis di: https://opencellid.org/register (kuota gratis ada limit harian).

async function estimasiLokasiTower({ mcc, mnc, lac, cellId }) {
  const apiKey = process.env.OPENCELLID_API_KEY;
  if (!apiKey || !mcc || !mnc || !lac || !cellId) return null;

  try {
    const url = `https://opencellid.org/cell/get?key=${apiKey}&mcc=${mcc}&mnc=${mnc}&lac=${lac}&cellid=${cellId}&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const data = await res.json();
    if (typeof data.lat !== 'number' || typeof data.lon !== 'number') return null;

    return {
      lat: data.lat,
      lng: data.lon,
      radius_m: typeof data.range === 'number' ? data.range : null,
    };
  } catch (e) {
    // Timeout / tower belum ada di database OpenCellID / dll - bukan error fatal,
    // absen tetap diproses cuma tanpa estimasi tower.
    return null;
  }
}

module.exports = { estimasiLokasiTower };
