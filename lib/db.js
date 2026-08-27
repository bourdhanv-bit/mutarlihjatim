// lib/db.js
// Pengganti pola D1 `env.DB_<KODE>.prepare(...).bind(...).all()`.
// Turso pakai @libsql/client -- versi "/web" dipakai supaya kompatibel dengan Vercel Edge Runtime
// (sama seperti Cloudflare Workers, tidak ada Node.js APIs penuh di Edge Runtime).

import { createClient } from "@libsql/client/web";

let _centralClient = null;

export function getCentralDb() {
  if (!_centralClient) {
    _centralClient = createClient({
      url: process.env.TURSO_CENTRAL_URL,
      authToken: process.env.TURSO_CENTRAL_AUTH_TOKEN,
    });
  }
  return _centralClient;
}

// Cache koneksi kabkota per invocation supaya tidak connect ulang tiap query dalam 1 request.
const _kabkotaClients = new Map();

// Resolve client Turso untuk 1 kabkota. Kredensialnya diambil dari tabel `kabkota` di central
// (kolom turso_url/turso_token), BUKAN dari environment variable -- supaya nambah kabkota baru
// tidak perlu redeploy Vercel.
export async function resolveKabkotaDb(kabkotaKode) {
  if (_kabkotaClients.has(kabkotaKode)) return _kabkotaClients.get(kabkotaKode);

  const central = getCentralDb();
  const result = await central.execute({
    sql: "SELECT turso_url, turso_token FROM kabkota WHERE kode = ?",
    args: [kabkotaKode],
  });

  const row = result.rows[0];
  if (!row || !row.turso_url) {
    throw new Error(`Kredensial Turso untuk kabkota '${kabkotaKode}' belum diisi di tabel central`);
  }

  const client = createClient({ url: row.turso_url, authToken: row.turso_token });
  _kabkotaClients.set(kabkotaKode, client);
  return client;
}

// Helper kecil supaya pola pemanggilan mirip D1 (all/first) -- memudahkan porting kode lama.
export async function dbAll(client, sql, args = []) {
  const result = await client.execute({ sql, args });
  return result.rows;
}

export async function dbFirst(client, sql, args = []) {
  const result = await client.execute({ sql, args });
  return result.rows[0] || null;
}

export async function dbRun(client, sql, args = []) {
  return await client.execute({ sql, args });
}
