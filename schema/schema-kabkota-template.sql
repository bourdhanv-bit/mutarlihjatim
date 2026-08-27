-- schema-kabkota-template.sql
-- Dijalankan SEKALI PER DATABASE kab/kota (jadi 38x total, satu per daerah).
-- Contoh: npx wrangler d1 execute mutarlihjatim-kab-malang --file=schema/schema-kabkota-template.sql
--
-- Generalisasi dari schema lama pemilih-malang-db + uji-petik-malang-db:
-- - Nama kecamatan tetap TEXT biasa (bukan foreign key ke database central, lihat catatan di
--   schema-central.sql), supaya tiap database kabkota tetap independen.
-- - Semua kategori TMS/disabilitas/pemilih-baru tetap konstanta yang sama untuk semua kabkota
--   (aturan resmi KPU/Bawaslu, tidak berubah per daerah), didefinisikan di kode (src/labels.js),
--   bukan di tabel.

-- ================= MODUL PEMILIH (bekas AWASI MUTARLIH) =================

CREATE TABLE pemilih (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kecamatan TEXT NOT NULL,
  kelurahan TEXT NOT NULL,
  nkk TEXT,
  nik TEXT NOT NULL,
  nama TEXT NOT NULL,
  tempat_lahir TEXT,
  tanggal_lahir TEXT,
  sts_kawin TEXT,
  kelamin TEXT,
  alamat TEXT,
  rt TEXT,
  rw TEXT,
  disabilitas TEXT,          -- kode 1-6, lihat src/labels.js
  ektp TEXT,
  keterangan TEXT,
  sumber TEXT,
  tps TEXT,
  kode_tms TEXT,             -- kode 1-7, lihat src/labels.js, NULL = masih memenuhi syarat (MS)
  tanggal_tms TEXT,
  tanggal_input TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_pemilih_nik ON pemilih(nik);
CREATE INDEX idx_pemilih_kecamatan ON pemilih(kecamatan);
CREATE INDEX idx_pemilih_kode_tms ON pemilih(kode_tms);

-- Audit trail perubahan kode TMS
CREATE TABLE tms_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pemilih_id INTEGER NOT NULL REFERENCES pemilih(id),
  kode_tms_lama TEXT,
  kode_tms_baru TEXT,
  username TEXT NOT NULL,
  dicatat_pada TEXT DEFAULT (datetime('now'))
);

-- Audit trail koreksi field non-TMS (nama/alamat/dll, kategori "Ubah Data")
CREATE TABLE ubah_data_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pemilih_id INTEGER NOT NULL REFERENCES pemilih(id),
  field TEXT NOT NULL,
  nilai_lama TEXT,
  nilai_baru TEXT,
  username TEXT NOT NULL,
  dicatat_pada TEXT DEFAULT (datetime('now'))
);

-- Snapshot statistik bulanan (dipakai infografis, cron tanggal 1 tiap bulan)
CREATE TABLE snapshot_bulanan (
  bulan TEXT PRIMARY KEY,   -- 'YYYY-MM'
  data_json TEXT NOT NULL,
  dibuat_pada TEXT DEFAULT (datetime('now'))
);

-- ================= MODUL UJI PETIK (bekas uji-petik-malang) =================

CREATE TABLE checklist_jawaban (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  triwulan TEXT NOT NULL,     -- format 'YYYY-Q1', dst
  nomor_prosedur INTEGER NOT NULL,
  jawaban TEXT,
  catatan TEXT,
  username TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(triwulan, nomor_prosedur)
);

CREATE TABLE rekap_triwulan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  triwulan TEXT NOT NULL,
  kecamatan TEXT NOT NULL,
  data_json TEXT NOT NULL,   -- PDPB Awal + 8 kategori TMS + 5 kategori Baru, masing2 L/P
  username TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(triwulan, kecamatan)
);

CREATE TABLE masukan_pleno (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  triwulan TEXT NOT NULL,
  kecamatan TEXT NOT NULL,
  isi TEXT NOT NULL,
  username TEXT NOT NULL,
  dicatat_pada TEXT DEFAULT (datetime('now'))
);

-- Tabel generik untuk sampel TMS (A-DPB5) dan sampel pemilih baru/MS (A-DPB7)
-- dibedakan lewat kolom `jenis` supaya tidak perlu 2 tabel kembar
CREATE TABLE sampel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jenis TEXT NOT NULL,        -- 'tms' | 'ms'
  periode TEXT NOT NULL,      -- format 'YYYY-MM'
  kecamatan TEXT NOT NULL,
  nama TEXT,
  nik TEXT,
  alamat TEXT,
  kelurahan TEXT,
  kategori TEXT NOT NULL,     -- kode kategori TMS (8 macam) atau kategori pemilih baru (5 macam)
  status TEXT NOT NULL,       -- 'sesuai' | 'tidak_sesuai'
  username TEXT NOT NULL,
  dicatat_pada TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_sampel_periode ON sampel(jenis, periode);

CREATE TABLE sampel_dpb (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  periode TEXT NOT NULL,
  kecamatan TEXT NOT NULL,
  data_json TEXT NOT NULL,
  username TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(periode, kecamatan)
);
