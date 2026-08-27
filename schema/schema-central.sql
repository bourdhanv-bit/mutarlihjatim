-- schema-central.sql (versi Turso)
-- Dijalankan sekali di database mutarlihjatim-central:
--   turso db shell mutarlihjatim-central < schema/schema-central.sql

CREATE TABLE kabkota (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode TEXT UNIQUE NOT NULL,        -- 'kab-malang', 'kota-surabaya', dst
  nama TEXT NOT NULL,
  jenis TEXT NOT NULL,              -- 'kabupaten' / 'kota'
  -- Kredensial Turso disimpan di sini (bukan sebagai env var terpisah per kabkota di Vercel),
  -- supaya tidak perlu 76 environment variable dan menambah kabkota baru tidak perlu redeploy.
  -- Diisi lewat schema/update-kredensial-kabkota.sql setelah tiap database dibuat.
  turso_url TEXT,
  turso_token TEXT
);

CREATE TABLE kecamatan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kabkota_id INTEGER NOT NULL REFERENCES kabkota(id),
  nama TEXT NOT NULL,
  urutan INTEGER DEFAULT 0
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,      -- "saltHex:hashHex" (PBKDF2-SHA256), sama seperti sebelumnya
  nama TEXT,
  role TEXT NOT NULL,               -- 'admin_kabkota' | 'admin_provinsi'
  kabkota_id INTEGER REFERENCES kabkota(id)   -- NULL untuk admin_provinsi
);

CREATE TABLE rekap_provinsi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kabkota_id INTEGER NOT NULL REFERENCES kabkota(id),
  periode TEXT NOT NULL,
  modul TEXT NOT NULL,              -- 'pemilih' | 'uji_petik'
  data_json TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(kabkota_id, periode, modul)
);
