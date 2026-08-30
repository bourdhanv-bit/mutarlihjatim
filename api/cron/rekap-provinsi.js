// api/cron/rekap-provinsi.js
// Dipanggil terjadwal oleh Vercel Cron (lihat vercel.json), pengganti `scheduled()` event
// di Cloudflare Workers. Vercel Cron memanggil endpoint ini via HTTP GET pada jadwal yang diatur.
//
// Menyimpan SNAPSHOT harian ke rekap_provinsi (central) supaya /api/provinsi/rekap punya data
// historis per periode -- beda dari /api/provinsi/ringkasan* yang selalu hitung ULANG live tiap
// dibuka (tidak tersimpan). Dua modul dihitung setiap cron jalan:
//   - 'pemilih'   -> periode = bulan berjalan ('YYYY-MM')
//   - 'uji_petik' -> periode = triwulan berjalan ('YYYY-QN')
export const config = { runtime: "edge" };

import { getCentralDb, resolveKabkotaDb, dbAll, dbFirst, dbRun } from "../../lib/db.js";

function currentPeriodeBulan() {
  return new Date().toISOString().slice(0, 7); // 'YYYY-MM'
}
function currentPeriodeTriwulan() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `${now.getFullYear()}-Q${q}`;
}
function bulanDalamTriwulan(triwulan) {
  const [year, q] = triwulan.split("-Q").map(Number);
  const startMonth = (q - 1) * 3 + 1;
  return [0, 1, 2].map((i) => `${year}-${String(startMonth + i).padStart(2, "0")}`);
}

async function upsertRekap(central, kabkotaId, periode, modul, dataObj) {
  await dbRun(
    central,
    `INSERT INTO rekap_provinsi (kabkota_id, periode, modul, data_json)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(kabkota_id, periode, modul) DO UPDATE SET data_json = excluded.data_json, updated_at = datetime('now')`,
    [kabkotaId, periode, modul, JSON.stringify(dataObj)]
  );
}

export default async function handler(request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const central = getCentralDb();
  const kabkotaList = await dbAll(central, "SELECT id, kode FROM kabkota WHERE turso_url IS NOT NULL");

  const periodeBulan = currentPeriodeBulan();
  const periodeTriwulan = currentPeriodeTriwulan();
  const bulanTriwulan = bulanDalamTriwulan(periodeTriwulan);

  let ok = 0;
  let gagal = 0;

  for (const k of kabkotaList) {
    try {
      const db = await resolveKabkotaDb(k.kode);

      // ---- Modul Pemilih: total MS (L/P), TMS, disabilitas ----
      const pemilihRow = await dbFirst(
        db,
        `SELECT
           SUM(CASE WHEN kode_tms IS NULL AND kelamin = 'L' THEN 1 ELSE 0 END) as laki,
           SUM(CASE WHEN kode_tms IS NULL AND kelamin = 'P' THEN 1 ELSE 0 END) as perempuan,
           SUM(CASE WHEN kode_tms IS NOT NULL THEN 1 ELSE 0 END) as tms,
           SUM(CASE WHEN kode_tms IS NULL AND disabilitas IS NOT NULL AND disabilitas != '' AND disabilitas != '0' THEN 1 ELSE 0 END) as disabilitas
         FROM pemilih`
      );
      await upsertRekap(central, k.id, periodeBulan, "pemilih", {
        laki: pemilihRow.laki || 0,
        perempuan: pemilihRow.perempuan || 0,
        tms: pemilihRow.tms || 0,
        disabilitas: pemilihRow.disabilitas || 0,
      });

      // ---- Modul Uji Petik: checklist triwulan berjalan, sampel 3 bulan triwulan berjalan,
      // hasil akhir rekap triwulan berjalan (kalau sudah diisi) ----
      const monthPlaceholders = bulanTriwulan.map(() => "?").join(",");
      const [tmsRow, msRow, dpbRow, checklistRow, rekapRows] = await Promise.all([
        dbFirst(db, `SELECT COUNT(*) as total FROM sampel_tms WHERE periode IN (${monthPlaceholders})`, bulanTriwulan),
        dbFirst(db, `SELECT COUNT(*) as total FROM sampel_ms WHERE periode IN (${monthPlaceholders})`, bulanTriwulan),
        dbFirst(db, `SELECT COUNT(*) as total, SUM(CASE WHEN hasil = 'Sesuai' THEN 1 ELSE 0 END) as sesuai FROM sampel_dpb WHERE periode IN (${monthPlaceholders})`, bulanTriwulan),
        dbFirst(db, "SELECT COUNT(*) as total FROM checklist_jawaban WHERE triwulan = ? AND jawaban IS NOT NULL", [periodeTriwulan]),
        dbAll(db, "SELECT hasil_akhir_laki, hasil_akhir_perempuan FROM rekap_triwulan WHERE triwulan = ?", [periodeTriwulan]),
      ]);

      let hasilLaki = 0, hasilPerempuan = 0;
      for (const r of rekapRows) { hasilLaki += r.hasil_akhir_laki || 0; hasilPerempuan += r.hasil_akhir_perempuan || 0; }

      await upsertRekap(central, k.id, periodeTriwulan, "uji_petik", {
        checklistTerisi: checklistRow.total || 0,
        sampelTms: tmsRow.total || 0,
        sampelMs: msRow.total || 0,
        sampelDpb: dpbRow.total || 0,
        sampelDpbSesuai: dpbRow.sesuai || 0,
        hasilLaki, hasilPerempuan,
      });

      ok++;
    } catch (err) {
      // Kabkota yang belum diisi kredensial Turso (belum aktif dipakai) dilewati saja, tidak
      // menggagalkan seluruh proses cron untuk 37 kabkota lain.
      console.error(`Gagal rekap ${k.kode}:`, err.message);
      gagal++;
    }
  }

  return new Response(`OK -- ${ok} kabkota berhasil, ${gagal} gagal`, { status: 200 });
}
