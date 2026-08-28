// api/handler.js
// Menangani semua /api/* (diarahkan lewat rewrites di vercel.json). Jalan di Edge Runtime supaya
// Web Crypto API (dipakai lib/auth.js) tetap tersedia native, sama seperti di Cloudflare Workers.
export const config = { runtime: "edge" };

import { verifyPassword, createSessionToken, verifySessionToken } from "../lib/auth.js";
import { getCentralDb, resolveKabkotaDb, dbAll, dbFirst, dbRun } from "../lib/db.js";
import { TMS_LABELS, DISABILITAS_LABELS, TMS_KATEGORI, MS_KATEGORI, TMS_CATS, BARU_CATS } from "../lib/labels.js";

const PAGE_SIZE = 50;
const MAX_BULK_NIK = 100; // dibatasi lebih ketat karena pencarian LIKE per-NIK men-scan seluruh tabel tiap token
const EDITABLE_FIELDS = [
  "nkk", "nik", "nama", "tempat_lahir", "tanggal_lahir", "sts_kawin", "kelamin",
  "alamat", "rt", "rw", "tps", "disabilitas", "ektp", "keterangan", "sumber",
];
const INPUT_COLS = [
  "kelurahan", "nkk", "nik", "nama", "tempat_lahir", "tanggal_lahir",
  "sts_kawin", "kelamin", "alamat", "rt", "rw", "disabilitas", "ektp",
  "keterangan", "sumber", "tps",
];

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function getUser(request) {
  const token = getCookie(request, "session");
  if (!token || !process.env.SESSION_SECRET) return null;
  return await verifySessionToken(token, process.env.SESSION_SECRET);
}

async function requireAuth(request, requireRole = null) {
  const user = await getUser(request);
  if (!user) return { error: json({ error: "Belum login" }, 401) };
  if (requireRole && user.role !== requireRole) {
    return { error: json({ error: "Tidak punya akses" }, 403) };
  }
  return { user };
}

export default async function handler(request) {
  const url = new URL(request.url);
  const path = url.pathname; // contoh: /api/pemilih/data
  const method = request.method;

  try {
    if (path === "/api/login" && method === "POST") return loginHandler(request);
    if (path === "/api/logout" && method === "POST") return logoutHandler();

    if (path === "/api/me" && method === "GET") {
      const { user, error } = await requireAuth(request);
      if (error) return error;
      return json({ username: user.username, role: user.role, kabkota: user.kabkotaKode });
    }

    if (path === "/api/master/kabkota" && method === "GET") {
      const { error } = await requireAuth(request);
      if (error) return error;
      const rows = await dbAll(getCentralDb(), "SELECT kode, nama, jenis FROM kabkota ORDER BY nama");
      return json(rows);
    }

    if (path.startsWith("/api/pemilih/")) {
      const { user, error } = await requireAuth(request, "admin_kabkota");
      if (error) return error;
      const db = await resolveKabkotaDb(user.kabkotaKode);
      return handlePemilihApi(request, url, db, user);
    }

    if (path.startsWith("/api/uji-petik/")) {
      const { user, error } = await requireAuth(request, "admin_kabkota");
      if (error) return error;
      const db = await resolveKabkotaDb(user.kabkotaKode);
      return handleUjiPetikApi(request, url, db, user);
    }

    if (path.startsWith("/api/dokumen")) {
      const { user, error } = await requireAuth(request, "admin_kabkota");
      if (error) return error;
      const db = await resolveKabkotaDb(user.kabkotaKode);
      return handleDokumenApi(request, url, db, user);
    }

    if (path.startsWith("/api/provinsi/")) {
      const { user, error } = await requireAuth(request, "admin_provinsi");
      if (error) return error;
      return handleProvinsiApi(request, url, user);
    }

    return json({ error: "Endpoint tidak ditemukan" }, 404);
  } catch (err) {
    return json({ error: "Terjadi kesalahan server: " + err.message }, 500);
  }
}

// ============== LOGIN ==============

async function loginHandler(request) {
  const { username, password } = await request.json();

  const row = await dbFirst(
    getCentralDb(),
    `SELECT u.username, u.password_hash, u.role, k.kode AS kabkota_kode
     FROM users u
     LEFT JOIN kabkota k ON k.id = u.kabkota_id
     WHERE u.username = ?`,
    [username]
  );

  if (!row) return json({ error: "Username atau password salah" }, 401);

  const valid = await verifyPassword(password, row.password_hash);
  if (!valid) return json({ error: "Username atau password salah" }, 401);

  const token = await createSessionToken(row.username, row.role, row.kabkota_kode, process.env.SESSION_SECRET);

  return json(
    { username: row.username, role: row.role, kabkota: row.kabkota_kode },
    200,
    { "Set-Cookie": `session=${encodeURIComponent(token)}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=43200` }
  );
}

function logoutHandler() {
  return json({ ok: true }, 200, {
    "Set-Cookie": "session=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0",
  });
}

// ============== MODUL PEMILIH ==============
//
// CATATAN PENYEDERHANAAN: versi Malang lama punya pembatasan akses per-kecamatan untuk 5 petugas
// (hasAccess/allowedKecamatan), karena 1 kabupaten dipakai banyak petugas berbeda tanggung jawab.
// Di arsitektur baru, 1 akun = akses penuh ke SEMUA kecamatan dalam kabkota-nya (sesuai lingkup
// "38 akun kab/kota" yang diminta). Kalau nanti perlu multi-petugas per kabkota lagi, tinggal
// tambahkan tabel user_kecamatan di database KABKOTA (bukan central) dan cek di sini.

// Cache sederhana pakai standard Cache API (tersedia di Vercel Edge Runtime, mirip Cloudflare
// Workers). Kalau runtime tidak dukung (mis. dijalankan lokal via `next dev` non-edge), langsung
// fallback hitung ulang tanpa cache -- tidak menggagalkan request.
async function withCache(keyParts, ttlSeconds, computeFn) {
  try {
    const cache = await caches.open("mutarlihjatim");
    const cacheKey = new Request("https://cache.internal/" + keyParts.map(encodeURIComponent).join("/"));
    const cached = await cache.match(cacheKey);
    if (cached) return await cached.json();

    const data = await computeFn();
    const response = new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${ttlSeconds}` },
    });
    await cache.put(cacheKey, response);
    return data;
  } catch {
    return await computeFn();
  }
}

// Hitung statistik LIVE se-kabkota (dipakai snapshot & tampilan real-time Tab Statistik)
async function computeStatistik(db) {
  const perKecRows = await dbAll(
    db,
    `SELECT kecamatan, kelamin, COUNT(*) as jumlah FROM pemilih WHERE kode_tms IS NULL
     GROUP BY kecamatan, kelamin ORDER BY kecamatan`
  );

  const kecMap = {};
  let totalLaki = 0, totalPerempuan = 0;
  for (const row of perKecRows) {
    if (!kecMap[row.kecamatan]) kecMap[row.kecamatan] = { kecamatan: row.kecamatan, laki: 0, perempuan: 0, jumlah: 0 };
    if (row.kelamin === "L") { kecMap[row.kecamatan].laki += row.jumlah; totalLaki += row.jumlah; }
    else if (row.kelamin === "P") { kecMap[row.kecamatan].perempuan += row.jumlah; totalPerempuan += row.jumlah; }
    kecMap[row.kecamatan].jumlah += row.jumlah;
  }

  const tmsRows = await dbAll(
    db,
    `SELECT kode_tms, COUNT(*) as jumlah FROM pemilih WHERE kode_tms IS NOT NULL GROUP BY kode_tms`
  );
  const tmsBreakdown = tmsRows.map((r) => ({ kode: r.kode_tms, label: TMS_LABELS[r.kode_tms] || r.kode_tms, jumlah: r.jumlah }));
  const totalTms = tmsBreakdown.reduce((sum, r) => sum + r.jumlah, 0);

  const disRows = await dbAll(
    db,
    `SELECT disabilitas, COUNT(*) as jumlah FROM pemilih
     WHERE disabilitas IS NOT NULL AND disabilitas != '' AND disabilitas != '0' AND kode_tms IS NULL
     GROUP BY disabilitas`
  );
  const disabilitasBreakdown = disRows.map((r) => ({ kode: r.disabilitas, label: DISABILITAS_LABELS[r.disabilitas] || r.disabilitas, jumlah: r.jumlah }));
  const totalDisabilitas = disabilitasBreakdown.reduce((sum, r) => sum + r.jumlah, 0);

  const totalUbahDataRow = await dbFirst(db, `SELECT COUNT(DISTINCT pemilih_id) as total FROM ubah_data_log`);
  const totalUbahData = totalUbahDataRow ? totalUbahDataRow.total : 0;

  return {
    totalPemilihMS: totalLaki + totalPerempuan,
    totalLaki,
    totalPerempuan,
    totalTms,
    totalDisabilitas,
    totalUbahData,
    perKecamatan: Object.values(kecMap).sort((a, b) => a.kecamatan.localeCompare(b.kecamatan)),
    tmsBreakdown,
    disabilitasBreakdown,
  };
}

async function generateSnapshot(db, bulanOverride) {
  const now = new Date();
  const bulan = bulanOverride || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const data = await computeStatistik(db);
  data.bulan = bulan;
  data.generatedAt = new Date().toISOString();

  await dbRun(
    db,
    `INSERT INTO snapshot_bulanan (bulan, data_json) VALUES (?, ?)
     ON CONFLICT(bulan) DO UPDATE SET data_json = excluded.data_json, dibuat_pada = datetime('now')`,
    [bulan, JSON.stringify(data)]
  );

  return data;
}

async function handlePemilihApi(request, url, db, user) {
  const path = url.pathname;
  const method = request.method;

  // ---- Rekap kecamatan (seluruh kabkota) ----
  if (path === "/api/pemilih/rekap-kecamatan" && method === "GET") {
    const data = await withCache(["rekap-kecamatan", user.kabkotaKode], 300, async () => {
      const results = await dbAll(
        db,
        `SELECT kecamatan, kelamin, COUNT(*) as jumlah FROM pemilih WHERE kode_tms IS NULL
         GROUP BY kecamatan, kelamin ORDER BY kecamatan`
      );
      const map = {};
      let totalLaki = 0, totalPerempuan = 0;
      for (const row of results) {
        if (!map[row.kecamatan]) map[row.kecamatan] = { kecamatan: row.kecamatan, laki: 0, perempuan: 0, jumlah: 0 };
        if (row.kelamin === "L") { map[row.kecamatan].laki += row.jumlah; totalLaki += row.jumlah; }
        else if (row.kelamin === "P") { map[row.kecamatan].perempuan += row.jumlah; totalPerempuan += row.jumlah; }
        map[row.kecamatan].jumlah += row.jumlah;
      }
      return {
        rekap: Object.values(map),
        grandTotal: { laki: totalLaki, perempuan: totalPerempuan, jumlah: totalLaki + totalPerempuan },
      };
    });
    return json(data);
  }

  // ---- Rekap per desa/TPS dalam 1 kecamatan ----
  if (path === "/api/pemilih/rekap-desa" && method === "GET") {
    const kecamatan = url.searchParams.get("kecamatan");
    if (!kecamatan) return json({ error: "Parameter kecamatan wajib diisi" }, 400);

    const data = await withCache(["rekap-desa", user.kabkotaKode, kecamatan], 300, async () => {
      const perDesa = await dbAll(
        db,
        `SELECT kelurahan, kelamin, COUNT(*) as jumlah FROM pemilih
         WHERE kecamatan = ? AND kode_tms IS NULL
         GROUP BY kelurahan, kelamin ORDER BY kelurahan`,
        [kecamatan]
      );
      const perTps = await dbAll(
        db,
        `SELECT kelurahan, tps, kelamin, COUNT(*) as jumlah FROM pemilih
         WHERE kecamatan = ? AND kode_tms IS NULL
         GROUP BY kelurahan, tps, kelamin ORDER BY kelurahan, CAST(tps AS INTEGER)`,
        [kecamatan]
      );

      const desaMap = {};
      for (const row of perDesa) {
        if (!desaMap[row.kelurahan]) desaMap[row.kelurahan] = { kelurahan: row.kelurahan, laki: 0, perempuan: 0, jumlah: 0 };
        if (row.kelamin === "L") desaMap[row.kelurahan].laki += row.jumlah;
        else if (row.kelamin === "P") desaMap[row.kelurahan].perempuan += row.jumlah;
        desaMap[row.kelurahan].jumlah += row.jumlah;
      }

      const tpsMap = {};
      for (const row of perTps) {
        const key = `${row.kelurahan}|${row.tps}`;
        if (!tpsMap[key]) tpsMap[key] = { kelurahan: row.kelurahan, tps: row.tps, laki: 0, perempuan: 0, jumlah: 0 };
        if (row.kelamin === "L") tpsMap[key].laki += row.jumlah;
        else if (row.kelamin === "P") tpsMap[key].perempuan += row.jumlah;
        tpsMap[key].jumlah += row.jumlah;
      }

      return { perDesa: Object.values(desaMap), perTps: Object.values(tpsMap) };
    });
    return json(data);
  }

  // ---- Rekap disabilitas per desa dalam 1 kecamatan ----
  if (path === "/api/pemilih/rekap-disabilitas" && method === "GET") {
    const kecamatan = url.searchParams.get("kecamatan");
    if (!kecamatan) return json({ error: "Parameter kecamatan wajib diisi" }, 400);

    const data = await withCache(["rekap-disabilitas", user.kabkotaKode, kecamatan], 300, async () => {
      const results = await dbAll(
        db,
        `SELECT kelurahan, disabilitas, kelamin, COUNT(*) as jumlah FROM pemilih
         WHERE kecamatan = ? AND disabilitas IS NOT NULL AND disabilitas != '' AND disabilitas != '0'
         GROUP BY kelurahan, disabilitas, kelamin ORDER BY kelurahan`,
        [kecamatan]
      );

      const desaMap = {};
      for (const row of results) {
        if (!desaMap[row.kelurahan]) desaMap[row.kelurahan] = { kelurahan: row.kelurahan, total: 0, breakdown: {} };
        const d = desaMap[row.kelurahan];
        d.total += row.jumlah;
        if (!d.breakdown[row.disabilitas]) {
          d.breakdown[row.disabilitas] = { label: DISABILITAS_LABELS[row.disabilitas] || row.disabilitas, laki: 0, perempuan: 0 };
        }
        if (row.kelamin === "L") d.breakdown[row.disabilitas].laki += row.jumlah;
        else if (row.kelamin === "P") d.breakdown[row.disabilitas].perempuan += row.jumlah;
      }

      return { rekap: Object.values(desaMap) };
    });
    return json(data);
  }

  // ---- Statistik live (real-time, di-cache 15 menit) ----
  if (path === "/api/pemilih/statistik/current" && method === "GET") {
    const data = await withCache(["statistik-current", user.kabkotaKode], 900, () => computeStatistik(db));
    return json(data);
  }

  // ---- Daftar bulan yang sudah punya snapshot tersimpan ----
  if (path === "/api/pemilih/statistik/snapshots" && method === "GET") {
    const results = await dbAll(db, "SELECT bulan, dibuat_pada FROM snapshot_bulanan ORDER BY bulan DESC");
    return json({ snapshots: results });
  }

  // ---- Ambil data 1 snapshot bulan tertentu ----
  if (path === "/api/pemilih/statistik/snapshot" && method === "GET") {
    const bulan = url.searchParams.get("bulan");
    if (!bulan) return json({ error: "Parameter bulan wajib diisi (format YYYY-MM)" }, 400);

    const row = await dbFirst(db, "SELECT data_json FROM snapshot_bulanan WHERE bulan = ?", [bulan]);
    if (!row) return json({ error: "Snapshot untuk bulan ini belum ada" }, 404);
    return json(JSON.parse(row.data_json));
  }

  // ---- Generate/refresh snapshot bulan berjalan secara manual ----
  if (path === "/api/pemilih/statistik/generate" && method === "POST") {
    const data = await generateSnapshot(db);
    return json({ ok: true, data });
  }

  // ---- TAB DATA: cari/list pemilih (support pencarian NIK massal) ----
  if (path === "/api/pemilih/data" && method === "GET") {
    const kecamatan = url.searchParams.get("kecamatan");
    const kelurahan = url.searchParams.get("kelurahan");
    const tps = url.searchParams.get("tps");
    const search = url.searchParams.get("search");
    const nama = url.searchParams.get("nama");
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));

    const nikTokens = search
      ? [...new Set(search.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))]
      : [];
    const isBulk = nikTokens.length > 1;

    if (isBulk && nikTokens.length > MAX_BULK_NIK) {
      return json({ error: `Maksimal ${MAX_BULK_NIK} NIK sekali cari. Anda memasukkan ${nikTokens.length} NIK — coba bagi jadi beberapa kali pencarian.` }, 400);
    }
    if (!kecamatan && nikTokens.length === 0 && !nama) {
      return json({ error: "Pilih kecamatan, isi Nama, atau isi NIK untuk cari (boleh lebih dari satu NIK, dipisah baris baru atau koma)" }, 400);
    }

    const offset = (page - 1) * PAGE_SIZE;
    let where = "WHERE 1=1";
    const params = [];
    if (kecamatan) { where += " AND kecamatan = ?"; params.push(kecamatan); }
    if (kelurahan) { where += " AND kelurahan = ?"; params.push(kelurahan); }
    if (tps) { where += " AND tps = ?"; params.push(tps); }
    if (nama) { where += " AND nama LIKE ?"; params.push(`%${nama}%`); }

    if (isBulk) {
      where += ` AND (${nikTokens.map(() => "nik LIKE ?").join(" OR ")})`;
      params.push(...nikTokens.map((t) => `%${t}%`));
    } else if (nikTokens.length === 1) {
      where += " AND nik LIKE ?";
      params.push(`%${nikTokens[0]}%`);
    }

    const baseQuery = `SELECT id, kecamatan, kelurahan, nkk, nik, nama, tempat_lahir, tanggal_lahir,
                          sts_kawin, kelamin, alamat, rt, rw, disabilitas, ektp, keterangan,
                          sumber, tps, kode_tms, tanggal_tms, tanggal_input
                   FROM pemilih ${where} ORDER BY nama`;

    if (isBulk) {
      const results = await dbAll(db, baseQuery, params);
      const notFound = nikTokens.filter(
        (token) => !results.some((r) => (r.nik || "").replace(/\s/g, "").includes(token.replace(/\s/g, "")))
      );
      return json({ data: results, total: results.length, page: 1, pageSize: results.length, bulk: true, searchedCount: nikTokens.length, notFound });
    }

    const results = await dbAll(db, `${baseQuery} LIMIT ? OFFSET ?`, [...params, PAGE_SIZE, offset]);
    const countRow = await dbFirst(db, `SELECT COUNT(*) as total FROM pemilih ${where}`, params);
    return json({ data: results, total: countRow.total, page, pageSize: PAGE_SIZE, bulk: false });
  }

  // ---- TAB DATA: tandai/ubah kode TMS satu pemilih ----
  if (path === "/api/pemilih/data" && method === "POST") {
    const { id, kode_tms } = await request.json();
    if (!id) return json({ error: "id wajib diisi" }, 400);

    const row = await dbFirst(db, "SELECT id, kode_tms FROM pemilih WHERE id = ?", [id]);
    if (!row) return json({ error: "Data pemilih tidak ditemukan" }, 404);

    const kodeBaru = kode_tms === "" || kode_tms === null || kode_tms === undefined ? null : String(kode_tms);

    await dbRun(db, "UPDATE pemilih SET kode_tms = ?, tanggal_tms = datetime('now') WHERE id = ?", [kodeBaru, id]);
    await dbRun(
      db,
      `INSERT INTO tms_log (pemilih_id, kode_tms_lama, kode_tms_baru, username) VALUES (?, ?, ?, ?)`,
      [id, row.kode_tms, kodeBaru, user.username]
    );

    return json({ ok: true });
  }

  // ---- Edit inline field pemilih (dicatat sebagai riwayat di ubah_data_log) ----
  if (path === "/api/pemilih/data/update" && method === "POST") {
    const { id, changes } = await request.json();
    if (!id || !changes || typeof changes !== "object") {
      return json({ error: "id dan changes wajib diisi" }, 400);
    }

    const fieldsToUpdate = Object.keys(changes).filter((f) => EDITABLE_FIELDS.includes(f));
    if (fieldsToUpdate.length === 0) return json({ error: "Tidak ada field valid yang diubah" }, 400);

    const row = await dbFirst(db, "SELECT * FROM pemilih WHERE id = ?", [id]);
    if (!row) return json({ error: "Data pemilih tidak ditemukan" }, 404);

    const actuallyChanged = fieldsToUpdate.filter((f) => String(row[f] ?? "") !== String(changes[f] ?? ""));
    if (actuallyChanged.length === 0) return json({ ok: true, changed: [] });

    const setClause = actuallyChanged.map((f) => `${f} = ?`).join(", ");
    const values = actuallyChanged.map((f) => (changes[f] === "" ? null : changes[f]));
    await dbRun(db, `UPDATE pemilih SET ${setClause} WHERE id = ?`, [...values, id]);

    for (const f of actuallyChanged) {
      await dbRun(
        db,
        `INSERT INTO ubah_data_log (pemilih_id, field, nilai_lama, nilai_baru, username) VALUES (?, ?, ?, ?, ?)`,
        [id, f, row[f] ?? "", changes[f] ?? "", user.username]
      );
    }

    return json({ ok: true, changed: actuallyChanged });
  }

  // ---- Input pemilih baru (banyak baris sekaligus) ----
  if (path === "/api/pemilih/pemilih-baru" && method === "POST") {
    const { kecamatan, rows } = await request.json();
    if (!kecamatan) return json({ error: "kecamatan wajib diisi" }, 400);
    if (!Array.isArray(rows) || rows.length === 0) return json({ error: "Tidak ada baris data untuk disimpan" }, 400);

    for (const row of rows) {
      const values = INPUT_COLS.map((_, i) => row[i] ?? null);
      await dbRun(
        db,
        `INSERT INTO pemilih (kecamatan, ${INPUT_COLS.join(", ")}, tanggal_input)
         VALUES (?, ${INPUT_COLS.map(() => "?").join(", ")}, datetime('now'))`,
        [kecamatan, ...values]
      );
    }

    return json({ ok: true, inserted: rows.length });
  }

  // ---- TAB PEMILIH MS (yang masih memenuhi syarat, kode_tms kosong) ----
  if (path === "/api/pemilih/pemilih-ms" && method === "GET") {
    const kecamatan = url.searchParams.get("kecamatan");
    const kelurahan = url.searchParams.get("kelurahan");
    const tps = url.searchParams.get("tps");
    const nama = url.searchParams.get("nama");
    const nik = url.searchParams.get("nik");
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const offset = (page - 1) * PAGE_SIZE;

    if (!kecamatan) return json({ error: "Parameter kecamatan wajib diisi" }, 400);

    let where = "WHERE kecamatan = ? AND kode_tms IS NULL";
    const params = [kecamatan];
    if (kelurahan) { where += " AND kelurahan = ?"; params.push(kelurahan); }
    if (tps) { where += " AND tps = ?"; params.push(tps); }
    if (nama) { where += " AND nama LIKE ?"; params.push(`%${nama}%`); }
    if (nik) { where += " AND nik LIKE ?"; params.push(`%${nik}%`); }

    const query = `SELECT id, kecamatan, kelurahan, nkk, nik, nama, tempat_lahir, tanggal_lahir,
                          sts_kawin, kelamin, alamat, rt, rw, disabilitas, ektp, keterangan, sumber, tps, tanggal_input
                   FROM pemilih ${where} ORDER BY nama LIMIT ? OFFSET ?`;
    const results = await dbAll(db, query, [...params, PAGE_SIZE, offset]);
    const countRow = await dbFirst(db, `SELECT COUNT(*) as total FROM pemilih ${where}`, params);

    return json({ data: results, total: countRow.total, page, pageSize: PAGE_SIZE });
  }

  // ---- Daftar pemilih berusia >= 100 tahun (deteksi data janggal) ----
  if (path === "/api/pemilih/pemilih-100" && method === "GET") {
    const kecamatan = url.searchParams.get("kecamatan");
    if (!kecamatan) return json({ error: "Parameter kecamatan wajib diisi" }, 400);

    const data = await withCache(["pemilih-100", user.kabkotaKode, kecamatan], 600, async () => {
      const currentYear = new Date().getFullYear();
      const results = await dbAll(
        db,
        `SELECT id, kecamatan, kelurahan, nkk, nik, nama, tempat_lahir, tanggal_lahir, kelamin, alamat, tps,
                (? - CAST(substr(tanggal_lahir, 7, 4) AS INTEGER)) as perkiraan_umur
         FROM pemilih
         WHERE kecamatan = ? AND kode_tms IS NULL
           AND tanggal_lahir LIKE '__/__/____'
           AND (? - CAST(substr(tanggal_lahir, 7, 4) AS INTEGER)) >= 100
         ORDER BY perkiraan_umur DESC`,
        [currentYear, kecamatan, currentYear]
      );
      return { data: results };
    });
    return json(data);
  }

  // ---- Filter helper: daftar kecamatan yang sudah punya data di kabkota ini ----
  if (path === "/api/pemilih/kecamatan" && method === "GET") {
    const data = await withCache(["kecamatan-list", user.kabkotaKode], 900, async () => {
      const results = await dbAll(db, "SELECT DISTINCT kecamatan FROM pemilih ORDER BY kecamatan");
      return { kecamatan: results.map((r) => r.kecamatan).filter(Boolean) };
    });
    return json(data);
  }

  // ---- Filter helper: daftar kelurahan dalam 1 kecamatan ----
  if (path === "/api/pemilih/kelurahan" && method === "GET") {
    const kecamatan = url.searchParams.get("kecamatan");
    if (!kecamatan) return json({ error: "Parameter kecamatan wajib diisi" }, 400);

    const data = await withCache(["kelurahan", user.kabkotaKode, kecamatan], 900, async () => {
      const results = await dbAll(db, "SELECT DISTINCT kelurahan FROM pemilih WHERE kecamatan = ? ORDER BY kelurahan", [kecamatan]);
      return { kelurahan: results.map((r) => r.kelurahan).filter(Boolean) };
    });
    return json(data);
  }

  // ---- Filter helper: daftar TPS dalam 1 kecamatan (opsional per kelurahan) ----
  if (path === "/api/pemilih/tps" && method === "GET") {
    const kecamatan = url.searchParams.get("kecamatan");
    const kelurahan = url.searchParams.get("kelurahan");
    if (!kecamatan) return json({ error: "Parameter kecamatan wajib diisi" }, 400);

    const data = await withCache(["tps", user.kabkotaKode, kecamatan, kelurahan || "_"], 900, async () => {
      let where = "WHERE kecamatan = ?";
      const params = [kecamatan];
      if (kelurahan) { where += " AND kelurahan = ?"; params.push(kelurahan); }
      const results = await dbAll(db, `SELECT DISTINCT tps FROM pemilih ${where} ORDER BY CAST(tps AS INTEGER)`, params);
      return { tps: results.map((r) => r.tps).filter(Boolean) };
    });
    return json(data);
  }

  // ---- TAB DATA TMS: list & rekap ----
  if (path === "/api/pemilih/tms/list" && method === "GET") {
    const kecamatan = url.searchParams.get("kecamatan");
    const kelurahan = url.searchParams.get("kelurahan");
    const tps = url.searchParams.get("tps");
    const nama = url.searchParams.get("nama");
    const nik = url.searchParams.get("nik");
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const offset = (page - 1) * PAGE_SIZE;

    let where = "WHERE kode_tms IS NOT NULL";
    const params = [];
    if (kecamatan) { where += " AND kecamatan = ?"; params.push(kecamatan); }
    if (kelurahan) { where += " AND kelurahan = ?"; params.push(kelurahan); }
    if (tps) { where += " AND tps = ?"; params.push(tps); }
    if (nama) { where += " AND nama LIKE ?"; params.push(`%${nama}%`); }
    if (nik) { where += " AND nik LIKE ?"; params.push(`%${nik}%`); }

    const results = await dbAll(
      db,
      `SELECT id, kecamatan, kelurahan, nkk, nik, nama, tempat_lahir, tanggal_lahir,
              sts_kawin, kelamin, alamat, rt, rw, disabilitas, ektp, keterangan,
              sumber, tps, kode_tms, tanggal_tms
       FROM pemilih ${where} ORDER BY tanggal_tms DESC LIMIT ? OFFSET ?`,
      [...params, PAGE_SIZE, offset]
    );
    const countRow = await dbFirst(db, `SELECT COUNT(*) as total FROM pemilih ${where}`, params);
    const withLabel = results.map((r) => ({ ...r, kode_tms_label: TMS_LABELS[r.kode_tms] || r.kode_tms }));

    return json({ data: withLabel, total: countRow.total, page, pageSize: PAGE_SIZE });
  }

  if (path === "/api/pemilih/tms/rekap" && method === "GET") {
    const results = await dbAll(
      db,
      `SELECT kecamatan, kode_tms, COUNT(*) as jumlah FROM pemilih WHERE kode_tms IS NOT NULL
       GROUP BY kecamatan, kode_tms ORDER BY kecamatan, kode_tms`
    );
    const rekapMap = {};
    for (const row of results) {
      if (!rekapMap[row.kecamatan]) rekapMap[row.kecamatan] = { kecamatan: row.kecamatan, total: 0, breakdown: {} };
      rekapMap[row.kecamatan].total += row.jumlah;
      rekapMap[row.kecamatan].breakdown[row.kode_tms] = { label: TMS_LABELS[row.kode_tms] || row.kode_tms, jumlah: row.jumlah };
    }
    return json({ rekap: Object.values(rekapMap) });
  }

  // ---- Deteksi NIK ganda (muncul lebih dari sekali di antara pemilih yang masih MS) ----
  if (path === "/api/pemilih/deteksi-ganda" && method === "GET") {
    const data = await withCache(["deteksi-ganda", user.kabkotaKode], 600, async () => {
      const dupNiks = await dbAll(
        db,
        `SELECT nik, COUNT(*) as jumlah FROM pemilih
         WHERE kode_tms IS NULL AND nik IS NOT NULL AND nik != ''
         GROUP BY nik HAVING COUNT(*) > 1
         ORDER BY jumlah DESC LIMIT 150`
      );
      if (dupNiks.length === 0) return { groups: [] };

      const nikList = dupNiks.map((r) => r.nik);
      const BATCH_SIZE = 50; // batasi jumlah parameter per query, sama seperti sebelumnya
      let records = [];
      for (let i = 0; i < nikList.length; i += BATCH_SIZE) {
        const batch = nikList.slice(i, i + BATCH_SIZE);
        const placeholders = batch.map(() => "?").join(",");
        const rows = await dbAll(
          db,
          `SELECT id, nik, kecamatan, kelurahan, nama, tempat_lahir, tanggal_lahir, alamat, tps
           FROM pemilih WHERE nik IN (${placeholders}) AND kode_tms IS NULL ORDER BY nik`,
          batch
        );
        records.push(...rows);
      }

      const groupMap = {};
      for (const rec of records) {
        if (!groupMap[rec.nik]) groupMap[rec.nik] = [];
        groupMap[rec.nik].push(rec);
      }
      return { groups: Object.entries(groupMap).map(([nik, records]) => ({ nik, records })) };
    });
    return json(data);
  }

  // ---- Cari 1 NIK spesifik di seluruh kabkota (index-based, ringan) ----
  if (path === "/api/pemilih/cari-nik-ganda" && method === "GET") {
    const nik = (url.searchParams.get("nik") || "").trim();
    if (!nik) return json({ error: "Parameter nik wajib diisi" }, 400);

    const results = await dbAll(
      db,
      `SELECT id, nik, kecamatan, kelurahan, nama, tempat_lahir, tanggal_lahir, alamat, tps, kode_tms
       FROM pemilih WHERE nik = ? ORDER BY kecamatan`,
      [nik]
    );
    return json({ records: results });
  }

  // ---- Infografis per kecamatan: bundel data detail untuk drill-down dari peta ----
  if (path === "/api/pemilih/infografis/kecamatan" && method === "GET") {
    const kecamatan = url.searchParams.get("kecamatan");
    if (!kecamatan) return json({ error: "Parameter kecamatan wajib diisi" }, 400);

    const data = await withCache(["infografis-kecamatan", user.kabkotaKode, kecamatan], 300, async () => {
      const currentYear = new Date().getFullYear();

      const desaRows = await dbAll(db, `SELECT kelurahan, kelamin, COUNT(*) as jumlah FROM pemilih WHERE kecamatan = ? AND kode_tms IS NULL GROUP BY kelurahan, kelamin`, [kecamatan]);
      const perDesaMap = {};
      for (const r of desaRows) {
        if (!perDesaMap[r.kelurahan]) perDesaMap[r.kelurahan] = { kelurahan: r.kelurahan, laki: 0, perempuan: 0, jumlah: 0 };
        if (r.kelamin === "L") perDesaMap[r.kelurahan].laki += r.jumlah;
        else if (r.kelamin === "P") perDesaMap[r.kelurahan].perempuan += r.jumlah;
        perDesaMap[r.kelurahan].jumlah += r.jumlah;
      }
      const perDesa = Object.values(perDesaMap);
      const totalLaki = perDesa.reduce((s, d) => s + d.laki, 0);
      const totalPerempuan = perDesa.reduce((s, d) => s + d.perempuan, 0);

      const disRows = await dbAll(
        db,
        `SELECT kelurahan, disabilitas, kelamin, COUNT(*) as jumlah FROM pemilih
         WHERE kecamatan = ? AND kode_tms IS NULL AND disabilitas IS NOT NULL AND disabilitas != '' AND disabilitas != '0'
         GROUP BY kelurahan, disabilitas, kelamin`,
        [kecamatan]
      );
      const disPerDesaMap = {};
      let totalDisabilitas = 0;
      for (const r of disRows) {
        if (!disPerDesaMap[r.kelurahan]) disPerDesaMap[r.kelurahan] = { kelurahan: r.kelurahan, total: 0, breakdown: {} };
        const d = disPerDesaMap[r.kelurahan];
        d.total += r.jumlah;
        totalDisabilitas += r.jumlah;
        if (!d.breakdown[r.disabilitas]) d.breakdown[r.disabilitas] = { label: DISABILITAS_LABELS[r.disabilitas] || r.disabilitas, laki: 0, perempuan: 0 };
        if (r.kelamin === "L") d.breakdown[r.disabilitas].laki += r.jumlah;
        else if (r.kelamin === "P") d.breakdown[r.disabilitas].perempuan += r.jumlah;
      }
      const disabilitasPerDesa = Object.values(disPerDesaMap);

      const tmsRows = await dbAll(db, `SELECT kode_tms, COUNT(*) as jumlah FROM pemilih WHERE kecamatan = ? AND kode_tms IS NOT NULL GROUP BY kode_tms`, [kecamatan]);
      const tmsBreakdown = tmsRows.map((r) => ({ kode: r.kode_tms, label: TMS_LABELS[r.kode_tms] || r.kode_tms, jumlah: r.jumlah }));
      const totalTms = tmsBreakdown.reduce((s, r) => s + r.jumlah, 0);

      const baruRows = await dbAll(db, `SELECT kelurahan, COUNT(*) as jumlah FROM pemilih WHERE kecamatan = ? AND tanggal_input IS NOT NULL GROUP BY kelurahan`, [kecamatan]);
      const pemilihBaruPerDesa = baruRows.map((r) => ({ kelurahan: r.kelurahan, jumlah: r.jumlah }));
      const totalPemilihBaru = pemilihBaruPerDesa.reduce((s, r) => s + r.jumlah, 0);

      const genRows = await dbAll(
        db,
        `SELECT
           CASE
             WHEN CAST(substr(tanggal_lahir,7,4) AS INTEGER) BETWEEN 1997 AND 2009 THEN 'Gen Z'
             WHEN CAST(substr(tanggal_lahir,7,4) AS INTEGER) BETWEEN 1981 AND 1996 THEN 'Milenial'
             WHEN CAST(substr(tanggal_lahir,7,4) AS INTEGER) BETWEEN 1965 AND 1980 THEN 'Gen X'
             WHEN CAST(substr(tanggal_lahir,7,4) AS INTEGER) BETWEEN 1946 AND 1964 THEN 'Baby Boomer'
             ELSE 'Lainnya'
           END as generasi,
           COUNT(*) as jumlah
         FROM pemilih WHERE kecamatan = ? AND kode_tms IS NULL AND tanggal_lahir LIKE '__/__/____'
         GROUP BY generasi`,
        [kecamatan]
      );
      const generasi = genRows.map((r) => ({ label: r.generasi, jumlah: r.jumlah }));

      const tmsAktivitas = await dbAll(db, `SELECT kelurahan, COUNT(*) as jumlah FROM pemilih WHERE kecamatan = ? AND tanggal_tms IS NOT NULL AND tanggal_tms >= datetime('now','-30 days') GROUP BY kelurahan`, [kecamatan]);
      const baruAktivitas = await dbAll(db, `SELECT kelurahan, COUNT(*) as jumlah FROM pemilih WHERE kecamatan = ? AND tanggal_input IS NOT NULL AND tanggal_input >= datetime('now','-30 days') GROUP BY kelurahan`, [kecamatan]);
      const ujiPetikMap = {};
      for (const r of tmsAktivitas) ujiPetikMap[r.kelurahan] = (ujiPetikMap[r.kelurahan] || 0) + r.jumlah;
      for (const r of baruAktivitas) ujiPetikMap[r.kelurahan] = (ujiPetikMap[r.kelurahan] || 0) + r.jumlah;
      const ujiPetikDesa = Object.entries(ujiPetikMap).map(([kelurahan, jumlah]) => ({ kelurahan, jumlah })).sort((a, b) => b.jumlah - a.jumlah);

      const ektpRows = await dbAll(db, `SELECT kelurahan, ektp, kelamin, COUNT(*) as jumlah FROM pemilih WHERE kecamatan = ? AND kode_tms IS NULL GROUP BY kelurahan, ektp, kelamin`, [kecamatan]);
      const ektpPerDesaMap = {};
      for (const r of ektpRows) {
        if (!ektpPerDesaMap[r.kelurahan]) ektpPerDesaMap[r.kelurahan] = { kelurahan: r.kelurahan, sudah: { laki: 0, perempuan: 0 }, belum: { laki: 0, perempuan: 0 } };
        const bucket = (r.ektp || "").toLowerCase() === "s" ? "sudah" : "belum";
        if (r.kelamin === "L") ektpPerDesaMap[r.kelurahan][bucket].laki += r.jumlah;
        else if (r.kelamin === "P") ektpPerDesaMap[r.kelurahan][bucket].perempuan += r.jumlah;
      }
      const ektpPerDesa = Object.values(ektpPerDesaMap);

      const umur100Rows = await dbAll(
        db,
        `SELECT kelurahan, COUNT(*) as jumlah FROM pemilih
         WHERE kecamatan = ? AND kode_tms IS NULL AND tanggal_lahir LIKE '__/__/____'
           AND (? - CAST(substr(tanggal_lahir,7,4) AS INTEGER)) >= 100
         GROUP BY kelurahan`,
        [kecamatan, currentYear]
      );
      const pemilih100PerDesa = umur100Rows.map((r) => ({ kelurahan: r.kelurahan, jumlah: r.jumlah }));

      // Ubah Data per desa -- JOIN ke pemilih via pemilih_id karena ubah_data_log di skema baru
      // tidak menyimpan kecamatan/kelurahan sendiri (beda dari skema Malang lama).
      const ubahRows = await dbAll(
        db,
        `SELECT p.kelurahan as kelurahan, COUNT(DISTINCT ud.pemilih_id) as jumlah
         FROM ubah_data_log ud JOIN pemilih p ON p.id = ud.pemilih_id
         WHERE p.kecamatan = ? GROUP BY p.kelurahan`,
        [kecamatan]
      );
      const ubahDataPerDesa = ubahRows.map((r) => ({ kelurahan: r.kelurahan, jumlah: r.jumlah }));
      const totalUbahData = ubahDataPerDesa.reduce((s, r) => s + r.jumlah, 0);

      return {
        kecamatan, totalPemilih: totalLaki + totalPerempuan, totalLaki, totalPerempuan, perDesa,
        totalDisabilitas, disabilitasPerDesa, tmsBreakdown, totalTms, totalPemilihBaru, pemilihBaruPerDesa,
        generasi, ujiPetikDesa, ektpPerDesa, pemilih100PerDesa, totalUbahData, ubahDataPerDesa,
      };
    });
    return json(data);
  }

  // ---- Rekap "Ubah Data" per desa (koreksi nama/alamat/dll) ----
  if (path === "/api/pemilih/ubah-data/rekap" && method === "GET") {
    const kecamatan = url.searchParams.get("kecamatan");
    const data = await withCache(["ubahdata-rekap", user.kabkotaKode, kecamatan || "_all"], 180, async () => {
      let where = "WHERE 1=1";
      const params = [];
      if (kecamatan) { where += " AND p.kecamatan = ?"; params.push(kecamatan); }

      const results = await dbAll(
        db,
        `SELECT p.kelurahan as kelurahan, COUNT(DISTINCT ud.pemilih_id) as jumlah
         FROM ubah_data_log ud JOIN pemilih p ON p.id = ud.pemilih_id ${where} GROUP BY p.kelurahan`,
        params
      );
      const perDesa = results.map((r) => ({ kelurahan: r.kelurahan, jumlah: r.jumlah }));
      const total = perDesa.reduce((s, r) => s + r.jumlah, 0);
      return { perDesa, total };
    });
    return json(data);
  }

  // ---- Daftar riwayat "Ubah Data" ----
  if (path === "/api/pemilih/ubah-data/list" && method === "GET") {
    const kecamatan = url.searchParams.get("kecamatan");
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const offset = (page - 1) * PAGE_SIZE;

    let where = "WHERE 1=1";
    const params = [];
    if (kecamatan) { where += " AND p.kecamatan = ?"; params.push(kecamatan); }

    const results = await dbAll(
      db,
      `SELECT ud.id, p.nik, p.kecamatan, p.kelurahan, ud.field, ud.nilai_lama, ud.nilai_baru, ud.username, ud.dicatat_pada, p.nama
       FROM ubah_data_log ud JOIN pemilih p ON p.id = ud.pemilih_id ${where}
       ORDER BY ud.dicatat_pada DESC LIMIT ? OFFSET ?`,
      [...params, PAGE_SIZE, offset]
    );
    const countRow = await dbFirst(
      db,
      `SELECT COUNT(*) as total FROM ubah_data_log ud JOIN pemilih p ON p.id = ud.pemilih_id ${where}`,
      params
    );

    return json({ data: results, total: countRow.total, page, pageSize: PAGE_SIZE });
  }

  return json({ error: "Endpoint modul pemilih belum dipindahkan: " + path }, 501);
}

// ============== MODUL UJI PETIK ==============
//
// CATATAN PENYEDERHANAAN: kode asli Malang memvalidasi kecamatan terhadap daftar 33 nama yang
// di-hardcode. Karena tiap kabkota di sistem baru punya daftar kecamatan sendiri-sendiri (belum
// ada master data kecamatan per kabkota yang terisi), validasi itu dilepas -- kecamatan diterima
// dinamis apa adanya dari yang diinput. Grid rekap triwulan juga tidak lagi selalu menampilkan
// SEMUA kecamatan resmi (karena tidak ada daftar tetapnya), melainkan kecamatan yang sudah pernah
// diisi datanya di triwulan berjalan atau triwulan sebelumnya (untuk carry-forward).

// Field grid A-DPB2 SESUAI FORM RESMI: PDPB Awal, 8 kategori TMS, 5 kategori Baru masing-masing
// 1 angka total (TIDAK ada L/P split di sini -- dikonfirmasi dari template resmi Jatim). Cuma
// Hasil Akhir yang dipecah L/P, dan itu diinput langsung, bukan hasil hitungan.
const REKAP_TW_FIELDS = [
  "pdpb_awal",
  ...TMS_CATS.map((c) => `tms_${c}`),
  ...BARU_CATS.map((c) => `baru_${c}`),
];

function withTotals(row) {
  const awal = row.pdpb_awal || 0;

  let tmsTotal = 0;
  for (const c of TMS_CATS) tmsTotal += row[`tms_${c}`] || 0;

  let baruTotal = 0;
  for (const c of BARU_CATS) baruTotal += row[`baru_${c}`] || 0;

  // Hasil akhir yang DIHITUNG (Awal - TMS + Baru) -- ini yang dibandingkan ke Hasil Akhir
  // yang DIINPUT LANGSUNG (hasil_akhir_laki/perempuan) untuk deteksi "selisih", persis seperti
  // kolom "selisih" di form resmi.
  const hasilHitungTotal = awal - tmsTotal + baruTotal;
  const hasilAkhirLaki = row.hasil_akhir_laki || 0;
  const hasilAkhirPerempuan = row.hasil_akhir_perempuan || 0;
  const hasilAkhirTotal = hasilAkhirLaki + hasilAkhirPerempuan;

  return {
    ...row,
    pdpb_awal_total: awal,
    tms_total: tmsTotal,
    baru_total: baruTotal,
    hasil_hitung_total: hasilHitungTotal,
    hasil_akhir_laki: hasilAkhirLaki,
    hasil_akhir_perempuan: hasilAkhirPerempuan,
    hasil_akhir_total: hasilAkhirTotal,
    selisih: hasilHitungTotal - hasilAkhirTotal,
  };
}

function previousTriwulan(tw) {
  const [yearStr, qStr] = tw.split("-Q");
  let year = Number(yearStr);
  let q = Number(qStr) - 1;
  if (q < 1) { q = 4; year -= 1; }
  return `${year}-Q${q}`;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function isSimilarDesaName(a, b) {
  if (a === b) return true;
  const threshold = Math.max(1, Math.floor(Math.max(a.length, b.length) * 0.25));
  return levenshtein(a, b) <= threshold;
}

async function latestTriwulan(db) {
  const row = await dbFirst(db, "SELECT triwulan FROM rekap_triwulan ORDER BY triwulan DESC LIMIT 1");
  return row ? row.triwulan : null;
}

// L/P per kecamatan pada triwulan tertentu -- dinamis dari data yang ada, bukan daftar tetap.
// Pakai Hasil Akhir yang DIINPUT LANGSUNG (bukan hasil_hitung), karena itu angka resmi final.
async function perKecamatanHasilAkhir(db, triwulan) {
  if (!triwulan) return [];
  const results = await dbAll(db, "SELECT * FROM rekap_triwulan WHERE triwulan = ?", [triwulan]);
  return results.map((row) => {
    const t = withTotals(row);
    return { kecamatan: row.kecamatan, laki: t.hasil_akhir_laki, perempuan: t.hasil_akhir_perempuan, total: t.hasil_akhir_total };
  });
}

async function monthlyMsTms(db, kecamatanFilter) {
  const tmsResult = kecamatanFilter
    ? await dbAll(db, "SELECT periode, COUNT(*) as jumlah FROM sampel_tms WHERE kecamatan = ? GROUP BY periode", [kecamatanFilter])
    : await dbAll(db, "SELECT periode, COUNT(*) as jumlah FROM sampel_tms GROUP BY periode");
  const msResult = kecamatanFilter
    ? await dbAll(db, "SELECT periode, COUNT(*) as jumlah FROM sampel_ms WHERE kecamatan = ? GROUP BY periode", [kecamatanFilter])
    : await dbAll(db, "SELECT periode, COUNT(*) as jumlah FROM sampel_ms GROUP BY periode");

  const byPeriode = {};
  for (const r of tmsResult) { byPeriode[r.periode] = byPeriode[r.periode] || { periode: r.periode, ms: 0, tms: 0 }; byPeriode[r.periode].tms = r.jumlah; }
  for (const r of msResult) { byPeriode[r.periode] = byPeriode[r.periode] || { periode: r.periode, ms: 0, tms: 0 }; byPeriode[r.periode].ms = r.jumlah; }
  return Object.values(byPeriode).sort((a, b) => a.periode.localeCompare(b.periode));
}

async function desaDiujiPetikCount(db, kecamatanFilter) {
  const where = kecamatanFilter ? "WHERE kecamatan = ? AND kelurahan IS NOT NULL AND TRIM(kelurahan) != ''" : "WHERE kelurahan IS NOT NULL AND TRIM(kelurahan) != ''";
  const bindArgs = kecamatanFilter ? [kecamatanFilter, kecamatanFilter, kecamatanFilter] : [];
  const sql = `
    SELECT DISTINCT kecamatan, UPPER(TRIM(kelurahan)) as kelurahan FROM (
      SELECT kecamatan, kelurahan FROM sampel_tms ${where}
      UNION
      SELECT kecamatan, kelurahan FROM sampel_ms ${where}
      UNION
      SELECT kecamatan, kelurahan FROM sampel_dpb ${where}
    )`;
  const results = await dbAll(db, sql, bindArgs);

  const byKecamatan = {};
  for (const row of results) {
    if (!byKecamatan[row.kecamatan]) byKecamatan[row.kecamatan] = [];
    byKecamatan[row.kecamatan].push(row.kelurahan);
  }

  let total = 0;
  for (const kec of Object.keys(byKecamatan)) {
    const clusters = [];
    for (const name of byKecamatan[kec]) {
      if (!clusters.some((rep) => isSimilarDesaName(name, rep))) clusters.push(name);
    }
    total += clusters.length;
  }
  return total;
}

async function kategoriBreakdown(db, table, cats, kategoriMap, kecamatanFilter) {
  const sql = kecamatanFilter
    ? `SELECT kategori, status, COUNT(*) as jumlah FROM ${table} WHERE kecamatan = ? GROUP BY kategori, status`
    : `SELECT kategori, status, COUNT(*) as jumlah FROM ${table} GROUP BY kategori, status`;
  const results = kecamatanFilter ? await dbAll(db, sql, [kecamatanFilter]) : await dbAll(db, sql);

  const breakdown = {};
  for (const key of cats) breakdown[key] = { label: kategoriMap[key], sesuai: 0, tidakSesuai: 0, jumlah: 0 };
  let total = 0;
  for (const row of results) {
    if (!breakdown[row.kategori]) continue;
    if (row.status === "Sesuai") breakdown[row.kategori].sesuai += row.jumlah;
    else breakdown[row.kategori].tidakSesuai += row.jumlah;
    breakdown[row.kategori].jumlah += row.jumlah;
    total += row.jumlah;
  }
  return { total, breakdown: Object.entries(breakdown).map(([kode, v]) => ({ kode, ...v })) };
}

async function triwulanComparison(db, kecamatanFilter) {
  const results = kecamatanFilter
    ? await dbAll(db, "SELECT * FROM rekap_triwulan WHERE kecamatan = ? ORDER BY triwulan", [kecamatanFilter])
    : await dbAll(db, "SELECT * FROM rekap_triwulan ORDER BY triwulan");

  const byTriwulan = {};
  for (const row of results) {
    const t = withTotals(row);
    if (!byTriwulan[row.triwulan]) byTriwulan[row.triwulan] = { triwulan: row.triwulan, laki: 0, perempuan: 0, total: 0 };
    byTriwulan[row.triwulan].laki += t.hasil_akhir_laki;
    byTriwulan[row.triwulan].perempuan += t.hasil_akhir_perempuan;
    byTriwulan[row.triwulan].total += t.hasil_akhir_total;
  }
  return Object.values(byTriwulan).sort((a, b) => a.triwulan.localeCompare(b.triwulan));
}

async function handleUjiPetikApi(request, url, db, user) {
  const path = url.pathname;
  const method = request.method;

  // ---- Helper generik: daftar nilai unik 1 kolom (dipakai untuk dropdown triwulan/periode) ----
  if (path === "/api/uji-petik/checklist/list-triwulan" && method === "GET") {
    const results = await dbAll(db, "SELECT DISTINCT triwulan as v FROM checklist_jawaban ORDER BY triwulan DESC");
    return json({ values: results.map((r) => r.v) });
  }
  if (path === "/api/uji-petik/rekap-triwulan/list-triwulan" && method === "GET") {
    const results = await dbAll(db, "SELECT DISTINCT triwulan as v FROM rekap_triwulan ORDER BY triwulan DESC");
    return json({ values: results.map((r) => r.v) });
  }
  if (path === "/api/uji-petik/sampel-tms/list-periode" && method === "GET") {
    const results = await dbAll(db, "SELECT DISTINCT periode as v FROM sampel_tms ORDER BY periode DESC");
    return json({ values: results.map((r) => r.v) });
  }
  if (path === "/api/uji-petik/sampel-ms/list-periode" && method === "GET") {
    const results = await dbAll(db, "SELECT DISTINCT periode as v FROM sampel_ms ORDER BY periode DESC");
    return json({ values: results.map((r) => r.v) });
  }
  if (path === "/api/uji-petik/sampel-dpb/list-periode" && method === "GET") {
    const results = await dbAll(db, "SELECT DISTINCT periode as v FROM sampel_dpb ORDER BY periode DESC");
    return json({ values: results.map((r) => r.v) });
  }

  // ---- TAB 1: Checklist 40 prosedur A-DPB1 ----
  if (path === "/api/uji-petik/checklist" && method === "GET") {
    const triwulan = url.searchParams.get("triwulan");
    if (!triwulan) return json({ error: "Parameter triwulan wajib diisi" }, 400);
    const results = await dbAll(db, "SELECT nomor_item, jawaban, keterangan FROM checklist_jawaban WHERE triwulan = ?", [triwulan]);
    const jawaban = {};
    for (const row of results) jawaban[row.nomor_item] = { jawaban: row.jawaban, keterangan: row.keterangan };
    return json({ triwulan, jawaban });
  }
  if (path === "/api/uji-petik/checklist" && method === "POST") {
    const { triwulan, jawaban } = await request.json();
    if (!triwulan || !Array.isArray(jawaban)) return json({ error: "triwulan dan jawaban (array) wajib diisi" }, 400);
    for (const j of jawaban) {
      await dbRun(
        db,
        `INSERT INTO checklist_jawaban (triwulan, nomor_item, jawaban, keterangan, diisi_oleh)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(triwulan, nomor_item) DO UPDATE SET
           jawaban = excluded.jawaban, keterangan = excluded.keterangan,
           diisi_oleh = excluded.diisi_oleh, diisi_pada = datetime('now')`,
        [triwulan, j.nomor_item, j.jawaban || null, j.keterangan || null, user.username]
      );
    }
    return json({ ok: true, saved: jawaban.length });
  }

  // ---- TAB 2: Rekap triwulan A-DPB2 ----
  if (path === "/api/uji-petik/rekap-triwulan" && method === "GET") {
    const triwulan = url.searchParams.get("triwulan");
    if (!triwulan) return json({ error: "Parameter triwulan wajib diisi" }, 400);

    const results = await dbAll(db, "SELECT * FROM rekap_triwulan WHERE triwulan = ?", [triwulan]);
    const prevResults = await dbAll(db, "SELECT * FROM rekap_triwulan WHERE triwulan = ?", [previousTriwulan(triwulan)]);
    const prevByKecamatan = {};
    for (const row of prevResults) prevByKecamatan[row.kecamatan] = withTotals(row);

    // Gabungan kecamatan yang sudah punya data di triwulan ini ATAU triwulan sebelumnya
    // (supaya carry-forward tetap kelihatan sebelum admin klik Simpan).
    const kecSet = new Set([...results.map((r) => r.kecamatan), ...prevResults.map((r) => r.kecamatan)]);

    const rows = [...kecSet].sort().map((kec) => {
      const existing = results.find((r) => r.kecamatan === kec);
      if (existing) return { ...withTotals(existing), carried_forward: false };

      const base = { kecamatan: kec, triwulan, ...Object.fromEntries(REKAP_TW_FIELDS.map((f) => [f, 0])), hasil_akhir_laki: 0, hasil_akhir_perempuan: 0 };
      const prev = prevByKecamatan[kec];
      let carried = false;
      if (prev) {
        // PDPB Awal triwulan berjalan = Hasil Akhir (total) triwulan sebelumnya.
        base.pdpb_awal = prev.hasil_akhir_total;
        carried = true;
      }
      return { ...withTotals(base), carried_forward: carried };
    });

    const grandRaw = Object.fromEntries(REKAP_TW_FIELDS.map((f) => [f, 0]));
    grandRaw.hasil_akhir_laki = 0;
    grandRaw.hasil_akhir_perempuan = 0;
    for (const r of rows) {
      for (const f of REKAP_TW_FIELDS) grandRaw[f] += r[f] || 0;
      grandRaw.hasil_akhir_laki += r.hasil_akhir_laki || 0;
      grandRaw.hasil_akhir_perempuan += r.hasil_akhir_perempuan || 0;
    }
    const grand = withTotals(grandRaw);

    return json({ triwulan, rows, grand, tmsCats: TMS_CATS, baruCats: BARU_CATS });
  }
  if (path === "/api/uji-petik/rekap-triwulan" && method === "POST") {
    const body = await request.json();
    const { triwulan, kecamatan } = body;
    if (!triwulan || !kecamatan) return json({ error: "triwulan dan kecamatan wajib diisi" }, 400);

    const allFields = [...REKAP_TW_FIELDS, "hasil_akhir_laki", "hasil_akhir_perempuan"];
    const values = allFields.map((f) => Number(body[f]) || 0);
    await dbRun(
      db,
      `INSERT INTO rekap_triwulan (triwulan, kecamatan, ${allFields.join(", ")}, diubah_oleh)
       VALUES (?, ?, ${allFields.map(() => "?").join(", ")}, ?)
       ON CONFLICT(triwulan, kecamatan) DO UPDATE SET
         ${allFields.map((f) => `${f} = excluded.${f}`).join(", ")},
         diubah_oleh = excluded.diubah_oleh, diubah_pada = datetime('now')`,
      [triwulan, kecamatan, ...values, user.username]
    );
    return json({ ok: true });
  }

  // ---- Masukan & Tanggapan Pleno A-DPB3 ----
  if (path === "/api/uji-petik/rekap-triwulan/masukan" && method === "GET") {
    const triwulan = url.searchParams.get("triwulan");
    if (!triwulan) return json({ error: "Parameter triwulan wajib diisi" }, 400);
    const results = await dbAll(db, "SELECT * FROM rekap_triwulan_masukan WHERE triwulan = ? ORDER BY id", [triwulan]);
    return json({ data: results });
  }
  if (path === "/api/uji-petik/rekap-triwulan/masukan" && method === "POST") {
    const { triwulan, nama_instansi, masukan_tanggapan, tindak_lanjut, keterangan } = await request.json();
    if (!triwulan || !nama_instansi) return json({ error: "triwulan dan nama_instansi wajib diisi" }, 400);
    await dbRun(
      db,
      `INSERT INTO rekap_triwulan_masukan (triwulan, nama_instansi, masukan_tanggapan, tindak_lanjut, keterangan, dicatat_oleh)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [triwulan, nama_instansi, masukan_tanggapan || null, tindak_lanjut || null, keterangan || null, user.username]
    );
    return json({ ok: true });
  }
  if (path === "/api/uji-petik/rekap-triwulan/masukan" && method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "Parameter id wajib diisi" }, 400);
    await dbRun(db, "DELETE FROM rekap_triwulan_masukan WHERE id = ?", [id]);
    return json({ ok: true });
  }

  // ---- TAB 3 & 4: Sampel TMS (A-DPB5) & Sampel Pemilih Baru/MS (A-DPB7) ----
  // Kedua tab strukturnya identik (beda tabel & kategori saja), ditangani 1 blok kode dengan
  // parameter `table` dan `kategoriMap` yang dipilih sesuai prefix path.
  const sampelConfig = path.startsWith("/api/uji-petik/sampel-tms")
    ? { table: "sampel_tms", kategoriMap: TMS_KATEGORI, prefix: "/api/uji-petik/sampel-tms" }
    : path.startsWith("/api/uji-petik/sampel-ms")
    ? { table: "sampel_ms", kategoriMap: MS_KATEGORI, prefix: "/api/uji-petik/sampel-ms" }
    : null;

  if (sampelConfig && path === `${sampelConfig.prefix}/rekap` && method === "GET") {
    const periode = url.searchParams.get("periode");
    if (!periode) return json({ error: "Parameter periode wajib diisi" }, 400);
    const results = await dbAll(db, `SELECT kategori, status, COUNT(*) as jumlah FROM ${sampelConfig.table} WHERE periode = ? GROUP BY kategori, status`, [periode]);
    const breakdown = {};
    for (const key of Object.keys(sampelConfig.kategoriMap)) breakdown[key] = { label: sampelConfig.kategoriMap[key], sesuai: 0, tidakSesuai: 0, jumlah: 0 };
    let total = 0;
    for (const row of results) {
      if (!breakdown[row.kategori]) continue;
      if (row.status === "Sesuai") breakdown[row.kategori].sesuai += row.jumlah;
      else breakdown[row.kategori].tidakSesuai += row.jumlah;
      breakdown[row.kategori].jumlah += row.jumlah;
      total += row.jumlah;
    }
    return json({ periode, total, breakdown: Object.entries(breakdown).map(([kode, v]) => ({ kode, ...v })) });
  }

  if (sampelConfig && path === `${sampelConfig.prefix}/bulk` && method === "POST") {
    const { rows } = await request.json();
    if (!Array.isArray(rows) || rows.length === 0) return json({ error: "Tidak ada baris data untuk disimpan" }, 400);
    let inserted = 0;
    for (const row of rows) {
      if (!row.periode || !row.nama || !row.kecamatan || !row.kategori || !(row.kategori in sampelConfig.kategoriMap)) continue;
      const status = row.status === "Tidak Sesuai" ? "Tidak Sesuai" : "Sesuai";
      await dbRun(
        db,
        `INSERT INTO ${sampelConfig.table} (periode, nama, nik, alamat, kelurahan, kecamatan, kategori, status, keterangan, dientri_oleh)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.periode, row.nama, row.nik || null, row.alamat || null, row.kelurahan || null, row.kecamatan, row.kategori, status, row.keterangan || null, user.username]
      );
      inserted++;
    }
    if (inserted === 0) return json({ error: "Tidak ada baris valid untuk disimpan" }, 400);
    return json({ ok: true, inserted });
  }

  if (sampelConfig && path === sampelConfig.prefix && method === "GET") {
    const periode = url.searchParams.get("periode");
    const nama = url.searchParams.get("nama");
    const nik = url.searchParams.get("nik");
    if (!periode) return json({ error: "Parameter periode wajib diisi" }, 400);
    let where = "WHERE periode = ?";
    const params = [periode];
    if (nama) { where += " AND nama LIKE ?"; params.push(`%${nama}%`); }
    if (nik) { where += " AND nik LIKE ?"; params.push(`%${nik}%`); }
    const results = await dbAll(db, `SELECT * FROM ${sampelConfig.table} ${where} ORDER BY dientri_pada DESC`, params);
    return json({ data: results });
  }

  if (sampelConfig && path === sampelConfig.prefix && method === "POST") {
    const body = await request.json();
    const { id, periode, nama, nik, alamat, kelurahan, kecamatan, kategori, status, keterangan } = body;
    if (!periode || !nama || !kecamatan || !kategori) return json({ error: "periode, nama, kecamatan, dan kategori wajib diisi" }, 400);
    if (!(kategori in sampelConfig.kategoriMap)) return json({ error: "Kategori tidak valid" }, 400);
    if (status && status !== "Sesuai" && status !== "Tidak Sesuai") return json({ error: "Status harus 'Sesuai' atau 'Tidak Sesuai'" }, 400);

    if (id) {
      await dbRun(
        db,
        `UPDATE ${sampelConfig.table} SET periode=?, nama=?, nik=?, alamat=?, kelurahan=?, kecamatan=?, kategori=?, status=?, keterangan=? WHERE id = ?`,
        [periode, nama, nik || null, alamat || null, kelurahan || null, kecamatan, kategori, status || "Sesuai", keterangan || null, id]
      );
      return json({ ok: true, id });
    }

    const result = await dbRun(
      db,
      `INSERT INTO ${sampelConfig.table} (periode, nama, nik, alamat, kelurahan, kecamatan, kategori, status, keterangan, dientri_oleh)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [periode, nama, nik || null, alamat || null, kelurahan || null, kecamatan, kategori, status || "Sesuai", keterangan || null, user.username]
    );
    return json({ ok: true, id: result.lastInsertRowid ? Number(result.lastInsertRowid) : undefined });
  }

  if (sampelConfig && path === sampelConfig.prefix && method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "Parameter id wajib diisi" }, 400);
    await dbRun(db, `DELETE FROM ${sampelConfig.table} WHERE id = ?`, [id]);
    return json({ ok: true });
  }

  // ---- TAB 5: Sampel DPB A-DPB8 ----
  if (path === "/api/uji-petik/sampel-dpb" && method === "GET") {
    const periode = url.searchParams.get("periode");
    const nama = url.searchParams.get("nama");
    const nik = url.searchParams.get("nik");
    if (!periode) return json({ error: "Parameter periode wajib diisi" }, 400);
    let where = "WHERE periode = ?";
    const params = [periode];
    if (nama) { where += " AND nama LIKE ?"; params.push(`%${nama}%`); }
    if (nik) { where += " AND nik LIKE ?"; params.push(`%${nik}%`); }
    const results = await dbAll(db, `SELECT * FROM sampel_dpb ${where} ORDER BY dientri_pada DESC`, params);
    return json({ data: results });
  }
  if (path === "/api/uji-petik/sampel-dpb" && method === "POST") {
    const body = await request.json();
    const { id, periode, nama, nik, alamat, kelurahan, kecamatan, hasil, kategori_tidak_sesuai, keterangan } = body;
    if (!periode || !nama || !kecamatan) return json({ error: "periode, nama, dan kecamatan wajib diisi" }, 400);
    if (hasil && hasil !== "Sesuai" && hasil !== "Tidak Sesuai") return json({ error: "Hasil harus 'Sesuai' atau 'Tidak Sesuai'" }, 400);
    if (hasil === "Tidak Sesuai" && (!kategori_tidak_sesuai || !(kategori_tidak_sesuai in TMS_KATEGORI))) {
      return json({ error: "Kategori wajib dipilih ketika hasil Tidak Sesuai" }, 400);
    }
    const kategoriFinal = hasil === "Tidak Sesuai" ? kategori_tidak_sesuai : null;

    if (id) {
      await dbRun(
        db,
        `UPDATE sampel_dpb SET periode=?, nama=?, nik=?, alamat=?, kelurahan=?, kecamatan=?, hasil=?, kategori_tidak_sesuai=?, keterangan=? WHERE id = ?`,
        [periode, nama, nik || null, alamat || null, kelurahan || null, kecamatan, hasil || "Sesuai", kategoriFinal, keterangan || null, id]
      );
      return json({ ok: true, id });
    }

    const result = await dbRun(
      db,
      `INSERT INTO sampel_dpb (periode, nama, nik, alamat, kelurahan, kecamatan, hasil, kategori_tidak_sesuai, keterangan, dientri_oleh)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [periode, nama, nik || null, alamat || null, kelurahan || null, kecamatan, hasil || "Sesuai", kategoriFinal, keterangan || null, user.username]
    );
    return json({ ok: true, id: result.lastInsertRowid ? Number(result.lastInsertRowid) : undefined });
  }
  if (path === "/api/uji-petik/sampel-dpb" && method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "Parameter id wajib diisi" }, 400);
    await dbRun(db, "DELETE FROM sampel_dpb WHERE id = ?", [id]);
    return json({ ok: true });
  }
  if (path === "/api/uji-petik/sampel-dpb/bulk" && method === "POST") {
    const { rows } = await request.json();
    if (!Array.isArray(rows) || rows.length === 0) return json({ error: "Tidak ada baris data untuk disimpan" }, 400);
    let inserted = 0;
    for (const row of rows) {
      if (!row.periode || !row.nama || !row.kecamatan) continue;
      const hasil = row.hasil === "Tidak Sesuai" ? "Tidak Sesuai" : "Sesuai";
      const kategoriFinal = hasil === "Tidak Sesuai" && row.kategori_tidak_sesuai in TMS_KATEGORI ? row.kategori_tidak_sesuai : null;
      await dbRun(
        db,
        `INSERT INTO sampel_dpb (periode, nama, nik, alamat, kelurahan, kecamatan, hasil, kategori_tidak_sesuai, keterangan, dientri_oleh)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.periode, row.nama, row.nik || null, row.alamat || null, row.kelurahan || null, row.kecamatan, hasil, kategoriFinal, row.keterangan || null, user.username]
      );
      inserted++;
    }
    if (inserted === 0) return json({ error: "Tidak ada baris valid untuk disimpan" }, 400);
    return json({ ok: true, inserted });
  }
  if (path === "/api/uji-petik/sampel-dpb/rekap" && method === "GET") {
    const periode = url.searchParams.get("periode");
    if (!periode) return json({ error: "Parameter periode wajib diisi" }, 400);

    const totalRow = await dbFirst(db, "SELECT COUNT(*) as total FROM sampel_dpb WHERE periode = ?", [periode]);
    const sesuaiRow = await dbFirst(db, "SELECT COUNT(*) as jumlah FROM sampel_dpb WHERE periode = ? AND hasil = 'Sesuai'", [periode]);
    const tidakRows = await dbAll(db, "SELECT kategori_tidak_sesuai, COUNT(*) as jumlah FROM sampel_dpb WHERE periode = ? AND hasil = 'Tidak Sesuai' GROUP BY kategori_tidak_sesuai", [periode]);

    const breakdownTidakSesuai = tidakRows.map((r) => ({ kode: r.kategori_tidak_sesuai, label: TMS_KATEGORI[r.kategori_tidak_sesuai] || r.kategori_tidak_sesuai, jumlah: r.jumlah }));

    return json({ periode, total: totalRow.total, sesuai: sesuaiRow.jumlah, tidakSesuai: totalRow.total - sesuaiRow.jumlah, breakdownTidakSesuai });
  }

  // ---- TAB 6: Infografis (agregasi lintas tabel untuk peta + chart) ----
  if (path === "/api/uji-petik/infografis/kabupaten" && method === "GET") {
    const data = await withCache(["uji-petik-infografis-kabupaten", user.kabkotaKode], 300, async () => {
      const triwulan = await latestTriwulan(db);
      const [perKecamatan, monthly, desaCount, ms, tms, triwulanComp] = await Promise.all([
        perKecamatanHasilAkhir(db, triwulan),
        monthlyMsTms(db, null),
        desaDiujiPetikCount(db, null),
        kategoriBreakdown(db, "sampel_ms", BARU_CATS, MS_KATEGORI, null),
        kategoriBreakdown(db, "sampel_tms", TMS_CATS, TMS_KATEGORI, null),
        triwulanComparison(db, null),
      ]);
      return {
        triwulan, perKecamatan, monthlyMsTms: monthly, desaDiujiPetik: desaCount,
        totalMsDiujiPetik: ms.total, totalTmsDiujiPetik: tms.total,
        kategoriMs: ms.breakdown, kategoriTms: tms.breakdown, triwulanComparison: triwulanComp,
      };
    });
    return json(data);
  }
  if (path === "/api/uji-petik/infografis/kecamatan" && method === "GET") {
    const kecamatan = url.searchParams.get("nama");
    if (!kecamatan) return json({ error: "Parameter nama (kecamatan) wajib diisi" }, 400);

    const data = await withCache(["uji-petik-infografis-kecamatan", user.kabkotaKode, kecamatan], 300, async () => {
      const triwulan = await latestTriwulan(db);
      const [perKecamatan, monthly, desaCount, ms, tms, triwulanComp] = await Promise.all([
        perKecamatanHasilAkhir(db, triwulan),
        monthlyMsTms(db, kecamatan),
        desaDiujiPetikCount(db, kecamatan),
        kategoriBreakdown(db, "sampel_ms", BARU_CATS, MS_KATEGORI, kecamatan),
        kategoriBreakdown(db, "sampel_tms", TMS_CATS, TMS_KATEGORI, kecamatan),
        triwulanComparison(db, kecamatan),
      ]);
      const found = perKecamatan.find((k) => k.kecamatan === kecamatan) || { laki: 0, perempuan: 0, total: 0 };
      return {
        kecamatan, triwulan, laki: found.laki, perempuan: found.perempuan, total: found.total,
        monthlyMsTms: monthly, desaDiujiPetik: desaCount,
        totalMsDiujiPetik: ms.total, totalTmsDiujiPetik: tms.total,
        kategoriMs: ms.breakdown, kategoriTms: tms.breakdown, triwulanComparison: triwulanComp,
      };
    });
    return json(data);
  }

  return json({ error: "Endpoint modul uji petik belum dipindahkan: " + path }, 501);
}

// ============== MODUL PROVINSI ==============

// ============== MODUL DOKUMEN PENGAWASAN ==============

const DOKUMEN_KATEGORI = ["saran_perbaikan", "imbauan", "form_a"];
const MAX_DOKUMEN_SIZE = 5 * 1024 * 1024; // 5MB -- disimpan sebagai base64 di Turso, bukan object storage

// Uint8Array -> base64, per-chunk supaya tidak overflow stack untuk file besar.
function bytesToBase64(bytes) {
  const CHUNK = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function handleDokumenApi(request, url, db, user) {
  const path = url.pathname;
  const method = request.method;

  // ---- Unduh 1 file (dikembalikan sebagai binary, bukan JSON) ----
  if (path === "/api/dokumen/download" && method === "GET") {
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "Parameter id wajib diisi" }, 400);
    const row = await dbFirst(db, "SELECT nama_file, tipe_file, konten_base64 FROM dokumen_pengawasan WHERE id = ?", [id]);
    if (!row) return json({ error: "Dokumen tidak ditemukan" }, 404);
    const bytes = base64ToBytes(row.konten_base64);
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": row.tipe_file || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${row.nama_file.replace(/"/g, "")}"`,
      },
    });
  }

  // ---- Daftar dokumen 1 kategori (tanpa konten base64 -- ringan) ----
  if (path === "/api/dokumen" && method === "GET") {
    const kategori = url.searchParams.get("kategori");
    if (!kategori || !DOKUMEN_KATEGORI.includes(kategori)) return json({ error: "Kategori tidak valid" }, 400);
    const results = await dbAll(
      db,
      `SELECT id, tahun, bulan, nama_file, tipe_file, ukuran, keterangan, diupload_oleh, diupload_pada
       FROM dokumen_pengawasan WHERE kategori = ? ORDER BY tahun DESC, bulan DESC, diupload_pada DESC`,
      [kategori]
    );
    return json({ data: results });
  }

  // ---- Upload dokumen baru (multipart/form-data) ----
  if (path === "/api/dokumen" && method === "POST") {
    const form = await request.formData();
    const kategori = form.get("kategori");
    const tahun = Number(form.get("tahun"));
    const bulan = Number(form.get("bulan"));
    const keterangan = form.get("keterangan") || null;
    const file = form.get("file");

    if (!kategori || !DOKUMEN_KATEGORI.includes(kategori)) return json({ error: "Kategori tidak valid" }, 400);
    if (!tahun || !bulan || bulan < 1 || bulan > 12) return json({ error: "Tahun/bulan tidak valid" }, 400);
    if (!file || typeof file === "string") return json({ error: "File wajib diunggah" }, 400);
    if (file.size > MAX_DOKUMEN_SIZE) return json({ error: `Ukuran file maksimal 5MB (file ini ${(file.size / 1024 / 1024).toFixed(1)}MB)` }, 400);

    const buffer = new Uint8Array(await file.arrayBuffer());
    const kontenBase64 = bytesToBase64(buffer);

    await dbRun(
      db,
      `INSERT INTO dokumen_pengawasan (kategori, tahun, bulan, nama_file, tipe_file, ukuran, konten_base64, keterangan, diupload_oleh)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [kategori, tahun, bulan, file.name, file.type || null, file.size, kontenBase64, keterangan, user.username]
    );
    return json({ ok: true });
  }

  // ---- Hapus dokumen ----
  if (path === "/api/dokumen" && method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "Parameter id wajib diisi" }, 400);
    await dbRun(db, "DELETE FROM dokumen_pengawasan WHERE id = ?", [id]);
    return json({ ok: true });
  }

  return json({ error: "Endpoint tidak ditemukan" }, 404);
}

async function handleProvinsiApi(request, url, user) {
  const path = url.pathname;

  // ---- Dokumen Pengawasan milik PROVINSI sendiri (disimpan di central, bukan kabkota) ----
  if (path === "/api/provinsi/dokumen-prop" && request.method === "GET") {
    const kategori = url.searchParams.get("kategori");
    if (!kategori || !DOKUMEN_KATEGORI.includes(kategori)) return json({ error: "Kategori tidak valid" }, 400);
    const results = await dbAll(
      getCentralDb(),
      `SELECT id, tahun, bulan, nama_file, tipe_file, ukuran, keterangan, diupload_oleh, diupload_pada
       FROM dokumen_pengawasan_provinsi WHERE kategori = ? ORDER BY tahun DESC, bulan DESC, diupload_pada DESC`,
      [kategori]
    );
    return json({ data: results });
  }

  if (path === "/api/provinsi/dokumen-prop" && request.method === "POST") {
    const form = await request.formData();
    const kategori = form.get("kategori");
    const tahun = Number(form.get("tahun"));
    const bulan = Number(form.get("bulan"));
    const keterangan = form.get("keterangan") || null;
    const file = form.get("file");

    if (!kategori || !DOKUMEN_KATEGORI.includes(kategori)) return json({ error: "Kategori tidak valid" }, 400);
    if (!tahun || !bulan || bulan < 1 || bulan > 12) return json({ error: "Tahun/bulan tidak valid" }, 400);
    if (!file || typeof file === "string") return json({ error: "File wajib diunggah" }, 400);
    if (file.size > MAX_DOKUMEN_SIZE) return json({ error: `Ukuran file maksimal 5MB (file ini ${(file.size / 1024 / 1024).toFixed(1)}MB)` }, 400);

    const buffer = new Uint8Array(await file.arrayBuffer());
    const kontenBase64 = bytesToBase64(buffer);

    await dbRun(
      getCentralDb(),
      `INSERT INTO dokumen_pengawasan_provinsi (kategori, tahun, bulan, nama_file, tipe_file, ukuran, konten_base64, keterangan, diupload_oleh)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [kategori, tahun, bulan, file.name, file.type || null, file.size, kontenBase64, keterangan, user.username]
    );
    return json({ ok: true });
  }

  if (path === "/api/provinsi/dokumen-prop" && request.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "Parameter id wajib diisi" }, 400);
    await dbRun(getCentralDb(), "DELETE FROM dokumen_pengawasan_provinsi WHERE id = ?", [id]);
    return json({ ok: true });
  }

  if (path === "/api/provinsi/dokumen-prop/download" && request.method === "GET") {
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "Parameter id wajib diisi" }, 400);
    const row = await dbFirst(getCentralDb(), "SELECT nama_file, tipe_file, konten_base64 FROM dokumen_pengawasan_provinsi WHERE id = ?", [id]);
    if (!row) return json({ error: "Dokumen tidak ditemukan" }, 404);
    const bytes = base64ToBytes(row.konten_base64);
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": row.tipe_file || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${row.nama_file.replace(/"/g, "")}"`,
      },
    });
  }

  // ---- Rekap Dokumen Pengawasan lintas 38 kab/kota (jumlah per kategori) ----
  if (path === "/api/provinsi/dokumen-rekap" && request.method === "GET") {
    const central = getCentralDb();
    const kabkotaList = await dbAll(central, "SELECT kode, nama FROM kabkota WHERE turso_url IS NOT NULL ORDER BY nama");

    const perKabkota = await Promise.all(
      kabkotaList.map(async (k) => {
        try {
          const db = await resolveKabkotaDb(k.kode);
          const rows = await dbAll(db, "SELECT kategori, COUNT(*) as total FROM dokumen_pengawasan GROUP BY kategori");
          const counts = { saran_perbaikan: 0, imbauan: 0, form_a: 0 };
          for (const r of rows) counts[r.kategori] = r.total;
          return { kode: k.kode, nama: k.nama, ok: true, ...counts };
        } catch (err) {
          return { kode: k.kode, nama: k.nama, ok: false, saran_perbaikan: 0, imbauan: 0, form_a: 0 };
        }
      })
    );
    return json({ perKabkota, jumlahKabkota: kabkotaList.length });
  }

  // ---- Lihat daftar dokumen 1 kab/kota + 1 kategori (akses baca provinsi ke database kabkota) ----
  if (path === "/api/provinsi/dokumen" && request.method === "GET") {
    const kode = url.searchParams.get("kode");
    const kategori = url.searchParams.get("kategori");
    if (!kode || !kategori || !DOKUMEN_KATEGORI.includes(kategori)) return json({ error: "Parameter kode dan kategori wajib diisi/valid" }, 400);
    const db = await resolveKabkotaDb(kode);
    const results = await dbAll(
      db,
      `SELECT id, tahun, bulan, nama_file, tipe_file, ukuran, keterangan, diupload_oleh, diupload_pada
       FROM dokumen_pengawasan WHERE kategori = ? ORDER BY tahun DESC, bulan DESC, diupload_pada DESC`,
      [kategori]
    );
    return json({ data: results });
  }

  // ---- Unduh 1 dokumen milik kab/kota tertentu (dari sisi provinsi) ----
  if (path === "/api/provinsi/dokumen/download" && request.method === "GET") {
    const kode = url.searchParams.get("kode");
    const id = url.searchParams.get("id");
    if (!kode || !id) return json({ error: "Parameter kode dan id wajib diisi" }, 400);
    const db = await resolveKabkotaDb(kode);
    const row = await dbFirst(db, "SELECT nama_file, tipe_file, konten_base64 FROM dokumen_pengawasan WHERE id = ?", [id]);
    if (!row) return json({ error: "Dokumen tidak ditemukan" }, 404);
    const bytes = base64ToBytes(row.konten_base64);
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": row.tipe_file || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${row.nama_file.replace(/"/g, "")}"`,
      },
    });
  }

  // ---- Ringkasan live: agregasi langsung dari 38 database kab/kota (bukan dari cron) ----
  // Cron rekap harian belum berjalan otomatis (lihat README), jadi untuk sekarang dashboard
  // provinsi menghitung ulang tiap kali dibuka -- cukup ringan karena cuma query agregat
  // (COUNT/SUM), bukan tarik semua baris data pemilih.
  if (path === "/api/provinsi/ringkasan" && request.method === "GET") {
    const central = getCentralDb();
    const kabkotaList = await dbAll(central, "SELECT kode, nama FROM kabkota WHERE turso_url IS NOT NULL ORDER BY nama");

    const perKabkota = await Promise.all(
      kabkotaList.map(async (k) => {
        try {
          const db = await resolveKabkotaDb(k.kode);
          const row = await dbFirst(
            db,
            `SELECT
               SUM(CASE WHEN kode_tms IS NULL AND kelamin = 'L' THEN 1 ELSE 0 END) as laki,
               SUM(CASE WHEN kode_tms IS NULL AND kelamin = 'P' THEN 1 ELSE 0 END) as perempuan,
               SUM(CASE WHEN kode_tms IS NOT NULL THEN 1 ELSE 0 END) as tms,
               SUM(CASE WHEN kode_tms IS NULL AND disabilitas IS NOT NULL AND disabilitas != '' AND disabilitas != '0' THEN 1 ELSE 0 END) as disabilitas
             FROM pemilih`
          );
          return {
            kode: k.kode, nama: k.nama, ok: true,
            laki: row.laki || 0, perempuan: row.perempuan || 0, tms: row.tms || 0, disabilitas: row.disabilitas || 0,
          };
        } catch (err) {
          return { kode: k.kode, nama: k.nama, ok: false, laki: 0, perempuan: 0, tms: 0, disabilitas: 0, error: err.message };
        }
      })
    );

    const totalLaki = perKabkota.reduce((s, r) => s + r.laki, 0);
    const totalPerempuan = perKabkota.reduce((s, r) => s + r.perempuan, 0);
    const totalTms = perKabkota.reduce((s, r) => s + r.tms, 0);
    const totalDisabilitas = perKabkota.reduce((s, r) => s + r.disabilitas, 0);
    const gagal = perKabkota.filter((r) => !r.ok);

    return json({
      totalPemilih: totalLaki + totalPerempuan,
      totalLaki, totalPerempuan, totalTms, totalDisabilitas,
      jumlahKabkota: kabkotaList.length,
      perKabkota: perKabkota.sort((a, b) => (b.laki + b.perempuan) - (a.laki + a.perempuan)),
      gagal: gagal.length ? gagal.map((g) => ({ kode: g.kode, nama: g.nama })) : [],
    });
  }

  // ---- Ringkasan Uji Petik live: agregasi langsung dari 38 database kab/kota ----
  // ---- Ringkasan Uji Petik live per TRIWULAN spesifik (bukan "terakhir tiap daerah" lagi) ----
  if (path === "/api/provinsi/ringkasan-uji-petik" && request.method === "GET") {
    const triwulan = url.searchParams.get("triwulan");
    if (!triwulan) return json({ error: "Parameter triwulan wajib diisi (format YYYY-Q1..YYYY-Q4)" }, 400);

    // Turunkan 3 bulan (YYYY-MM) yang termasuk triwulan ini, buat filter tabel sampel yang
    // periodenya bulanan (bukan triwulan) -- Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Okt-Des.
    const [twYear, twQ] = triwulan.split("-Q").map(Number);
    const startMonth = (twQ - 1) * 3 + 1;
    const months = [0, 1, 2].map((i) => `${twYear}-${String(startMonth + i).padStart(2, "0")}`);

    const central = getCentralDb();
    const kabkotaList = await dbAll(central, "SELECT kode, nama FROM kabkota WHERE turso_url IS NOT NULL ORDER BY nama");

    const perKabkota = await Promise.all(
      kabkotaList.map(async (k) => {
        try {
          const db = await resolveKabkotaDb(k.kode);
          const monthPlaceholders = months.map(() => "?").join(",");
          const [tmsRow, msRow, dpbRow, checklistRow, rekapRows] = await Promise.all([
            dbFirst(db, `SELECT COUNT(*) as total FROM sampel_tms WHERE periode IN (${monthPlaceholders})`, months),
            dbFirst(db, `SELECT COUNT(*) as total FROM sampel_ms WHERE periode IN (${monthPlaceholders})`, months),
            dbFirst(db, `SELECT COUNT(*) as total, SUM(CASE WHEN hasil = 'Sesuai' THEN 1 ELSE 0 END) as sesuai FROM sampel_dpb WHERE periode IN (${monthPlaceholders})`, months),
            dbFirst(db, "SELECT COUNT(*) as total FROM checklist_jawaban WHERE triwulan = ? AND jawaban IS NOT NULL", [triwulan]),
            dbAll(db, "SELECT hasil_akhir_laki, hasil_akhir_perempuan FROM rekap_triwulan WHERE triwulan = ?", [triwulan]),
          ]);

          let hasilLaki = 0, hasilPerempuan = 0;
          for (const r of rekapRows) { hasilLaki += r.hasil_akhir_laki || 0; hasilPerempuan += r.hasil_akhir_perempuan || 0; }

          return {
            kode: k.kode, nama: k.nama, ok: true,
            sampelTms: tmsRow.total || 0, sampelMs: msRow.total || 0,
            sampelDpb: dpbRow.total || 0, sampelDpbSesuai: dpbRow.sesuai || 0,
            checklistTerisi: checklistRow.total || 0,
            adaRekapTriwulan: rekapRows.length > 0, hasilLaki, hasilPerempuan,
          };
        } catch (err) {
          return { kode: k.kode, nama: k.nama, ok: false, sampelTms: 0, sampelMs: 0, sampelDpb: 0, sampelDpbSesuai: 0, checklistTerisi: 0, adaRekapTriwulan: false, hasilLaki: 0, hasilPerempuan: 0, error: err.message };
        }
      })
    );

    const totalSampelTms = perKabkota.reduce((s, r) => s + r.sampelTms, 0);
    const totalSampelMs = perKabkota.reduce((s, r) => s + r.sampelMs, 0);
    const totalSampelDpb = perKabkota.reduce((s, r) => s + r.sampelDpb, 0);
    const totalSampelDpbSesuai = perKabkota.reduce((s, r) => s + r.sampelDpbSesuai, 0);
    const totalChecklistTerisi = perKabkota.reduce((s, r) => s + r.checklistTerisi, 0);
    const totalHasilLaki = perKabkota.reduce((s, r) => s + r.hasilLaki, 0);
    const totalHasilPerempuan = perKabkota.reduce((s, r) => s + r.hasilPerempuan, 0);
    const kabkotaSudahMulaiChecklist = perKabkota.filter((r) => r.checklistTerisi > 0).length;
    const gagal = perKabkota.filter((r) => !r.ok);

    return json({
      triwulan,
      totalSampelTms, totalSampelMs, totalSampelDpb, totalSampelDpbSesuai,
      totalChecklistTerisi, maksChecklist: kabkotaList.length * 40,
      kabkotaSudahMulaiChecklist, jumlahKabkota: kabkotaList.length,
      totalHasilLaki, totalHasilPerempuan, totalHasilAkhir: totalHasilLaki + totalHasilPerempuan,
      perKabkota: perKabkota.sort((a, b) => (b.sampelTms + b.sampelMs) - (a.sampelTms + a.sampelMs)),
      gagal: gagal.length ? gagal.map((g) => ({ kode: g.kode, nama: g.nama })) : [],
    });
  }
  if (path === "/api/provinsi/rekap" && request.method === "GET") {
    const periode = url.searchParams.get("periode");
    const modul = url.searchParams.get("modul") || "pemilih";
    const rows = await dbAll(
      getCentralDb(),
      `SELECT k.kode, k.nama, r.data_json, r.updated_at
       FROM rekap_provinsi r
       JOIN kabkota k ON k.id = r.kabkota_id
       WHERE r.periode = ? AND r.modul = ?
       ORDER BY k.nama`,
      [periode, modul]
    );
    return json(rows.map((r) => ({ ...r, data_json: JSON.parse(r.data_json) })));
  }

  return json({ error: "Endpoint tidak ditemukan" }, 404);
}
