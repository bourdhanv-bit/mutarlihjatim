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
8. `vercel deploy`

## Yang BELUM selesai (sama seperti versi Cloudflare, tinggal porting)

- Endpoint modul Pemilih & Uji Petik (`handlePemilihApi`/`handleUjiPetikApi` di `api/[...path].js`)
  masih skeleton -- perlu pindahkan dari kode lama, ganti pola D1 jadi `dbAll`/`dbFirst`/`dbRun`
  dari `lib/db.js`.
- Logika hitung ringkasan sungguhan di `api/cron/rekap-provinsi.js` (baru placeholder).
- Frontend (`public/`) belum dibuat.
- GeoJSON 37 kabkota selain Malang belum ada.
