-- schema-central-dokumen-migrasi-v1.sql
-- Jalankan ke database CENTRAL (bukan kabkota), untuk yang sudah dibuat sebelum fitur ini ada:
--   turso db shell mutarlihjatim-central < schema/schema-central-dokumen-migrasi-v1.sql

CREATE TABLE IF NOT EXISTS dokumen_pengawasan_provinsi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kategori TEXT NOT NULL,
  tahun INTEGER NOT NULL,
  bulan INTEGER NOT NULL,
  nama_file TEXT NOT NULL,
  tipe_file TEXT,
  ukuran INTEGER,
  konten_base64 TEXT NOT NULL,
  keterangan TEXT,
  diupload_oleh TEXT,
  diupload_pada TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dokumen_prov_kategori_tahun_bulan ON dokumen_pengawasan_provinsi(kategori, tahun, bulan);
