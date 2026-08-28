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
- **GeoJSON tiap kabkota**: baru ada punya Malang. 37 daerah lain perlu file batas kecamatan
  masing-masing untuk fitur peta/infografis.
- **Master data kecamatan per kabkota** (tabel `kecamatan` di database central) belum diisi
  untuk kabkota manapun. Efeknya: modul Uji Petik tidak lagi menampilkan grid tetap semua
  kecamatan resmi di rekap triwulan (beda dari versi Malang lama yang hardcode 33 kecamatan) --
  sekarang cuma menampilkan kecamatan yang sudah pernah diisi datanya. Kalau nanti mau
  kembalikan perilaku grid-selalu-lengkap: (1) isi tabel `kecamatan` di central per kabkota,
  (2) tambah endpoint fetch daftar itu, (3) sesuaikan `rekap-triwulan` GET di `api/handler.js`
  supaya union dengan daftar itu, bukan cuma dari data yang sudah ada.

## Jika Anda sudah pernah menjalankan `create-turso-databases.sh` sebelum modul Uji Petik selesai

38 database yang sudah dibuat lebih dulu memakai skema Uji Petik versi PERTAMA (salah desain,
kolom `data_json` generik). Sebelum memakai endpoint modul Uji Petik, jalankan migrasi ini dulu
(aman, tabelnya masih kosong):
```
bash scripts/apply-migrasi-uji-petik-v2.sh
```
Kalau Anda baru membuat 38 database dari nol (belum pernah jalankan `apply-schema-all.sh`
sebelumnya), tidak perlu ini -- `schema-kabkota-template.sql` sudah versi benar sejak awal.
