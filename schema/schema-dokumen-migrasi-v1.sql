-- schema-dokumen-migrasi-v1.sql
-- Menambah tabel dokumen_pengawasan untuk database yang sudah dibuat sebelum fitur ini ada.
-- Aman dijalankan ulang -- pakai IF NOT EXISTS supaya tidak error kalau sudah pernah dijalankan.

CREATE TABLE IF NOT EXISTS dokumen_pengawasan (
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
CREATE INDEX IF NOT EXISTS idx_dokumen_kategori_tahun_bulan ON dokumen_pengawasan(kategori, tahun, bulan);
