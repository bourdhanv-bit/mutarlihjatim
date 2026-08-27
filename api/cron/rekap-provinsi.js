// api/cron/rekap-provinsi.js
// Dipanggil terjadwal oleh Vercel Cron (lihat vercel.json), pengganti `scheduled()` event
// di Cloudflare Workers. Vercel Cron memanggil endpoint ini via HTTP GET pada jadwal yang diatur.
export const config = { runtime: "edge" };

import { getCentralDb, resolveKabkotaDb, dbAll, dbRun } from "../../lib/db.js";

export default async function handler(request) {
  // Vercel Cron mengirim header Authorization: Bearer <CRON_SECRET> -- verifikasi supaya
  // endpoint ini tidak bisa dipanggil sembarang orang dari luar.
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const central = getCentralDb();
  const kabkotaList = await dbAll(central, "SELECT id, kode FROM kabkota");

  for (const k of kabkotaList) {
    try {
      const db = await resolveKabkotaDb(k.kode);
      // TODO: hitung ringkasan sebenarnya (total MS, TMS per kategori, dst) dari database
      // kabkota `db`, mirip computeStatistik() di pemilih-malang-app lama. Contoh placeholder:
      const periode = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
      const ringkasan = { catatan: "placeholder, belum dihitung sungguhan" };

      await dbRun(
        central,
        `INSERT INTO rekap_provinsi (kabkota_id, periode, modul, data_json)
         VALUES (?, ?, 'pemilih', ?)
         ON CONFLICT(kabkota_id, periode, modul) DO UPDATE SET data_json = excluded.data_json, updated_at = datetime('now')`,
        [k.id, periode, JSON.stringify(ringkasan)]
      );
    } catch (err) {
      // Kabkota yang belum diisi kredensial Turso (belum aktif dipakai) dilewati saja, tidak
      // menggagalkan seluruh proses cron untuk 37 kabkota lain.
      console.error(`Gagal rekap ${k.kode}:`, err.message);
    }
  }

  return new Response("OK", { status: 200 });
}
