# mutarlihjatim (versi Vercel + Turso)

Versi ini menggantikan Cloudflare Workers + D1 dengan **Vercel + Turso**, arsitektur dan skema
data tetap sama (38 database kabkota terisolasi + 1 central untuk login & rekap provinsi).

## Perbedaan dari versi Cloudflare

| Cloudflare | Vercel + Turso |
|---|---|
| D1 (`env.DB_KODE`) | Turso (libSQL) -- kredensial per kabkota disimpan di tabel `kabkota` di central, bukan env var, supaya nambah kabkota baru tidak perlu redeploy |
| `env.ASSETS.fetch()` | Folder `public/` disajikan otomatis oleh Vercel |
| 1 file `src/index.js` (fetch handler) | `api/[...path].js` (Vercel catch-all API route), Edge Runtime |
| `scheduled()` event | Vercel Cron memanggil `api/cron/rekap-provinsi.js`, dijadwalkan di `vercel.json` |
| `wrangler.toml` (39 binding manual) | Tidak perlu 39 env var -- cukup kredensial central, sisanya query dinamis |

## Cara setup dari nol

1. Install Turso CLI: `curl -sSfL https://get.tur.so/install.sh | bash`, lalu `turso auth login`.
2. `npm install` (pasang `@libsql/client`).
3. Jalankan `bash scripts/create-turso-databases.sh` -- membuat 39 database Turso, mencetak
   kredensial central di akhir, dan menghasilkan `schema/update-kredensial-kabkota.sql`.
4. Ikuti 3 perintah `turso db shell` yang tercetak di akhir langkah 3 (jalankan schema central,
   isi seed 38 kabkota, isi kredensial kabkota ke central).
5. Jalankan `bash scripts/apply-schema-all.sh` untuk apply skema data ke 38 database kabkota.
6. Di Vercel Project Settings -> Environment Variables, isi:
   - `TURSO_CENTRAL_URL` dan `TURSO_CENTRAL_AUTH_TOKEN` (dari output langkah 3)
   - `SESSION_SECRET` (string acak panjang)
   - `CRON_SECRET` (string acak, dipakai Vercel Cron untuk otorisasi ke `api/cron/rekap-provinsi.js`)
7. Buat user admin_provinsi + 38 user admin_kabkota lewat `turso db shell mutarlihjatim-central`,
   password di-hash pakai `hashPassword()` di `lib/auth.js` (jalankan lewat script Node terpisah).

   Sudah tersedia `scripts/generate-seed-users.cjs` untuk ini -- generate 39 user sekaligus
   (semua pakai password yang sama, gampang diingat di awal, tinggal ganti nanti):

   ```
   node scripts/generate-seed-users.cjs > schema/seed-users.sql
   turso db shell mutarlihjatim-central < schema/seed-users.sql
   ```

   Skema username: `admin-provinsi` untuk akun provinsi, dan kode kabkota apa adanya
   (`kab-malang`, `kota-surabaya`, dst) untuk 38 akun kabkota -- daftar lengkap 38 username
   ada di `scripts/kabkota-list.json`. Password default ada di dalam file
   `scripts/generate-seed-users.cjs` (variabel `PASSWORD_SERAGAM`), ganti di situ kalau perlu
   password lain sebelum generate ulang.
8. `vercel deploy`

## Status endpoint

Modul Pemilih dan modul Uji Petik sekarang **sudah 100% dipindahkan** ke `api/handler.js`
(42 endpoint total). Yang belum selesai:

- **Cron rekap provinsi** (`api/cron/rekap-provinsi.js`) baru kerangka komentar, belum ada
  logika hitung ringkasan per kabkota dan kirim ke `rekap_provinsi`.
- **Frontend** (`public/`) belum dibuat sama sekali. Perlu: halaman login (deteksi role dari
  response `/api/login`, admin_kabkota masuk ke dashboard pemilih+uji-petik, admin_provinsi
  masuk ke dashboard rekap), lalu adaptasi `app.js`+`index.html`+`style.css` dari 2 app lama.
- **GeoJSON tiap kabkota**: sekarang SUDAH ADA untuk seluruh 38 kab/kota + 1 peta provinsi
  (lihat `public/geojson/`), disederhanakan dari file asli 56MB jadi total ~2,3MB (per-kabkota
  rata-rata puluhan KB saja, provinsi 544KB). Peta Leaflet sudah terintegrasi di Infografis
  kedua modul (Pemilih & Uji Petik) serta dashboard provinsi.
- **Master data kecamatan per kabkota** (tabel `kecamatan` di database central) belum diisi
  untuk kabkota manapun. Efeknya: modul Uji Petik tidak lagi menampilkan grid tetap semua
  kecamatan resmi di rekap triwulan (beda dari versi Malang lama yang hardcode 33 kecamatan) --
  sekarang cuma menampilkan kecamatan yang sudah pernah diisi datanya. Kalau nanti mau
  kembalikan perilaku grid-selalu-lengkap: (1) isi tabel `kecamatan` di central per kabkota,
  (2) tambah endpoint fetch daftar itu, (3) sesuaikan `rekap-triwulan` GET di `api/handler.js`
  supaya union dengan daftar itu, bukan cuma dari data yang sudah ada.
- **Peta Leaflet choropleth di Infografis** belum dibuat -- versi Malang lama punya peta
  interaktif per kecamatan, tapi itu butuh file GeoJSON batas kecamatan yang baru ada untuk
  Malang. 37 kabkota lain belum punya file itu. Infografis di versi ini sudah lengkap secara
  data (semua section: per desa, disabilitas, TMS, generasi, KTP-el, usia >=100, dst) hanya
  tanpa peta visual, ditampilkan sebagai card yang bisa diklik untuk drill-down per kecamatan.
- **Skema Rekap Triwulan A-DPB2 sudah dikoreksi (v3)** setelah dicek ulang dari template resmi
  Bawaslu Provinsi Jatim: PDPB Awal/TMS/Pemilih Baru masing-masing 1 angka (BUKAN dipecah L/P
  seperti asumsi awal), dan Hasil Akhir (L/P) diinput langsung dari angka resmi KPU, bukan
  hasil hitungan aplikasi -- aplikasi cuma menghitung "selisih" sebagai alat verifikasi. Kalau
  Anda sempat isi data uji coba dengan skema lama (v2), jalankan
  `bash scripts/apply-migrasi-rekap-triwulan-v3.sh` dulu (akan mengosongkan ulang tabel itu).
- **Checklist A-DPB1** sudah pakai teks 40 item resmi (5 kategori: Sinkronisasi, Koordinasi,
  Pemutakhiran, Rekapitulasi, Pengumuman), diambil dari template xlsx asli, bukan placeholder.

## Jika Anda sudah pernah menjalankan `create-turso-databases.sh` sebelum modul Dokumen Pengawasan ada

38 database yang sudah dibuat lebih dulu tidak punya tabel `dokumen_pengawasan`. Jalankan migrasi
ini dulu sebelum pakai fitur Dokumen Pengawasan (aman dijalankan berulang, pakai `IF NOT EXISTS`):
```
bash scripts/apply-migrasi-dokumen-all.sh
```
Database CENTRAL juga perlu migrasi terpisah untuk tabel dokumen milik provinsi sendiri:
```
turso db shell mutarlihjatim-central < schema/schema-central-dokumen-migrasi-v1.sql
```

## Catatan soal modul Dokumen Pengawasan

File disimpan sebagai base64 langsung di database Turso (bukan object storage terpisah seperti
Vercel Blob/S3), dibatasi maksimal **5MB per file** di level aplikasi. Ini cocok untuk dokumen
PDF/Word ukuran wajar, tapi kalau ke depan butuh menyimpan file jauh lebih besar (video, scan
resolusi tinggi banyak halaman), sebaiknya migrasi ke object storage terpisah.

## Jika Anda sudah pernah menjalankan `create-turso-databases.sh` sebelum modul Uji Petik selesai

38 database yang sudah dibuat lebih dulu memakai skema Uji Petik versi PERTAMA (salah desain,
kolom `data_json` generik). Sebelum memakai endpoint modul Uji Petik, jalankan migrasi ini dulu
(aman, tabelnya masih kosong):
```
bash scripts/apply-migrasi-uji-petik-v2.sh
```
Kalau Anda baru membuat 38 database dari nol (belum pernah jalankan `apply-schema-all.sh`
sebelumnya), tidak perlu ini -- `schema-kabkota-template.sql` sudah versi benar sejak awal.

## Fitur Super Admin (baru)

Akun `super-admin` bisa "masuk sebagai" kab/kota manapun atau provinsi tanpa perlu tahu password
masing-masing, plus fitur generate data pemilih dari Excel untuk kab/kota manapun langsung ke
database tujuan. **Sengaja dibuat lewat script terpisah** (`scripts/create-superadmin.cjs`), tidak
tercampur dengan `generate-seed-users.cjs` yang bikin 39 user standar, supaya tidak
"kelihatan"/tercampur di daftar user biasa.

Setup:
```
node scripts/create-superadmin.cjs > schema/seed-superadmin.sql
turso db shell mutarlihjatim-central < schema/seed-superadmin.sql
```
Username: `super-admin`, password sudah diset di dalam script itu sendiri (`1234567890)(*&^%$#@!`).

Fitur ganti password (tombol di kanan atas, semua role) memakai endpoint
`/api/account/ganti-password` -- berlaku untuk admin_kabkota, admin_provinsi, maupun super_admin,
tidak perlu setup tambahan.

Fitur unduh Excel memakai format **CSV** (bukan `.xlsx` biner asli) supaya tidak perlu menambah
library baru yang berat/berisiko di Edge Runtime -- CSV tetap terbuka normal di Excel/Sheets.
