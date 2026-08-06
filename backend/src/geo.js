// Hitung jarak antar 2 titik GPS pakai rumus Haversine (meter)
function jarakMeter(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Cek apakah titik berada dalam radius salah satu area kerja yang terdaftar
function cekDalamAreaKerja(lat, lng, daftarArea) {
  for (const area of daftarArea) {
    const jarak = jarakMeter(lat, lng, area.lat, area.lng);
    if (jarak <= area.radius_m) {
      return { dalamRadius: true, area, jarak: Math.round(jarak) };
    }
  }
  return { dalamRadius: false, area: null, jarak: null };
}

module.exports = { jarakMeter, cekDalamAreaKerja };
