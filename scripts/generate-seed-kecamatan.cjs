// scripts/generate-seed-kecamatan.cjs
// Isi tabel `kecamatan` (master data) di database CENTRAL dengan 666 kecamatan resmi dari
// 38 kab/kota se-Jatim (sumber: data BPS yang sama dipakai untuk file GeoJSON peta).
//
// Cara pakai:
//   node scripts/generate-seed-kecamatan.cjs > schema/seed-kecamatan.sql
//   turso db shell mutarlihjatim-central < schema/seed-kecamatan.sql
//
// Kegunaan tabel ini: begitu diisi, dropdown/grid yang butuh "daftar SEMUA kecamatan resmi"
// (misal grid Rekap Triwulan A-DPB2 supaya selalu tampil lengkap walau belum ada data masuk)
// bisa dikembangkan mengambil dari sini, bukan cuma dari kecamatan yang sudah ada datanya.

const kecamatanData = require("./kecamatan-data.json");

let out = "";
for (const [kode, daftarKecamatan] of Object.entries(kecamatanData)) {
  daftarKecamatan.forEach((nama, idx) => {
    const namaEsc = nama.replace(/'/g, "''");
    out += `INSERT INTO kecamatan (kabkota_id, nama, urutan) VALUES ((SELECT id FROM kabkota WHERE kode = '${kode}'), '${namaEsc}', ${idx + 1});\n`;
  });
}

console.log(out);
