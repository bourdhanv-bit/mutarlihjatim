// api/handler.js
// Menangani semua /api/* (diarahkan lewat rewrites di vercel.json). Jalan di Edge Runtime supaya
// Web Crypto API (dipakai lib/auth.js) tetap tersedia native, sama seperti di Cloudflare Workers.
export const config = { runtime: "edge" };

import { verifyPassword, createSessionToken, verifySessionToken } from "../lib/auth.js";
import { getCentralDb, resolveKabkotaDb, dbAll, dbFirst, dbRun } from "../lib/db.js";
import { TMS_LABELS, DISABILITAS_LABELS } from "../lib/labels.js";

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

    if (path.startsWith("/api/provinsi/")) {
      const { error } = await requireAuth(request, "admin_provinsi");
      if (error) return error;
      return handleProvinsiApi(request, url);
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
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));

    const nikTokens = search
      ? [...new Set(search.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))]
      : [];
    const isBulk = nikTokens.length > 1;

    if (isBulk && nikTokens.length > MAX_BULK_NIK) {
      return json({ error: `Maksimal ${MAX_BULK_NIK} NIK sekali cari. Anda memasukkan ${nikTokens.length} NIK — coba bagi jadi beberapa kali pencarian.` }, 400);
    }
    if (!kecamatan && nikTokens.length === 0) {
      return json({ error: "Pilih kecamatan, atau isi NIK untuk cari (boleh lebih dari satu NIK, dipisah baris baru atau koma)" }, 400);
    }

    const offset = (page - 1) * PAGE_SIZE;
    let where = "WHERE 1=1";
    const params = [];
    if (kecamatan) { where += " AND kecamatan = ?"; params.push(kecamatan); }
    if (kelurahan) { where += " AND kelurahan = ?"; params.push(kelurahan); }
    if (tps) { where += " AND tps = ?"; params.push(tps); }

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
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const offset = (page - 1) * PAGE_SIZE;

    if (!kecamatan) return json({ error: "Parameter kecamatan wajib diisi" }, 400);

    let where = "WHERE kecamatan = ? AND kode_tms IS NULL";
    const params = [kecamatan];
    if (kelurahan) { where += " AND kelurahan = ?"; params.push(kelurahan); }
    if (tps) { where += " AND tps = ?"; params.push(tps); }

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

  // TODO kelompok berikutnya: TMS list/rekap, deteksi ganda, infografis.
  return json({ error: "Endpoint modul pemilih belum dipindahkan: " + path }, 501);
}

// ============== MODUL UJI PETIK (skeleton, sama seperti versi Cloudflare) ==============

async function handleUjiPetikApi(request, url, db, user) {
  const path = url.pathname;
  // TODO: sama seperti di atas, sumbernya uji-petik-malang lama.
  return json({ error: "Endpoint modul uji petik belum dipindahkan: " + path }, 501);
}

// ============== MODUL PROVINSI ==============

async function handleProvinsiApi(request, url) {
  const path = url.pathname;

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
