// api/[...path].js
// Menangani semua /api/* (Vercel catch-all dynamic route). Jalan di Edge Runtime supaya
// Web Crypto API (dipakai lib/auth.js) tetap tersedia native, sama seperti di Cloudflare Workers.
export const config = { runtime: "edge" };

import { verifyPassword, createSessionToken, verifySessionToken } from "../lib/auth.js";
import { getCentralDb, resolveKabkotaDb, dbAll, dbFirst, dbRun } from "../lib/db.js";

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

// ============== MODUL PEMILIH (skeleton, sama seperti versi Cloudflare) ==============

async function handlePemilihApi(request, url, db, user) {
  const path = url.pathname;
  // TODO: pindahkan handler dari pemilih-malang-app lama ke sini, ganti pola D1
  // `env.DB.prepare(sql).bind(...args).all()` jadi `dbAll(db, sql, args)`
  // (dan `.first()` -> `dbFirst`, statement tanpa hasil -> `dbRun`).
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
