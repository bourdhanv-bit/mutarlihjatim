-- schema-uji-petik-migrasi-v2.sql
-- HANYA untuk database yang sudah terlanjur dibuat dengan schema-kabkota-template.sql versi
-- PERTAMA (yang salah desain, pakai kolom data_json generik untuk modul Uji Petik).
-- Aman dijalankan karena semua tabel ini masih kosong (belum ada data yang diinput).
--
-- Jalankan ke SEMUA 38 database kabkota yang sudah dibuat sebelum perbaikan ini:
--   turso db shell mutarlihjatim-<kode> < schema/schema-uji-petik-migrasi-v2.sql
-- (atau pakai scripts/apply-schema-all.sh yang sudah diupdate untuk pakai file ini)

DROP TABLE IF EXISTS checklist_jawaban;
DROP TABLE IF EXISTS rekap_triwulan;
DROP TABLE IF EXISTS masukan_pleno;
DROP TABLE IF EXISTS sampel;
DROP TABLE IF EXISTS sampel_dpb;

CREATE TABLE checklist_jawaban (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  triwulan TEXT NOT NULL,
  nomor_item INTEGER NOT NULL,
  jawaban TEXT,
  keterangan TEXT,
  diisi_oleh TEXT,
  diisi_pada TEXT DEFAULT (datetime('now')),
  UNIQUE(triwulan, nomor_item)
);

CREATE TABLE rekap_triwulan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  triwulan TEXT NOT NULL,
  kecamatan TEXT NOT NULL,
  pdpb_awal_laki INTEGER DEFAULT 0,
  pdpb_awal_perempuan INTEGER DEFAULT 0,
  tms_meninggal_laki INTEGER DEFAULT 0,
  tms_meninggal_perempuan INTEGER DEFAULT 0,
  tms_ganda_laki INTEGER DEFAULT 0,
  tms_ganda_perempuan INTEGER DEFAULT 0,
  tms_belum17_laki INTEGER DEFAULT 0,
  tms_belum17_perempuan INTEGER DEFAULT 0,
  tms_pindah_laki INTEGER DEFAULT 0,
  tms_pindah_perempuan INTEGER DEFAULT 0,
  tms_tni_laki INTEGER DEFAULT 0,
  tms_tni_perempuan INTEGER DEFAULT 0,
  tms_polri_laki INTEGER DEFAULT 0,
  tms_polri_perempuan INTEGER DEFAULT 0,
  tms_wna_laki INTEGER DEFAULT 0,
  tms_wna_perempuan INTEGER DEFAULT 0,
  tms_dicabut_laki INTEGER DEFAULT 0,
  tms_dicabut_perempuan INTEGER DEFAULT 0,
  baru_genap17_laki INTEGER DEFAULT 0,
  baru_genap17_perempuan INTEGER DEFAULT 0,
  baru_kawin_laki INTEGER DEFAULT 0,
  baru_kawin_perempuan INTEGER DEFAULT 0,
  baru_tni_polri_sipil_laki INTEGER DEFAULT 0,
  baru_tni_polri_sipil_perempuan INTEGER DEFAULT 0,
  baru_mantan_terpidana_laki INTEGER DEFAULT 0,
  baru_mantan_terpidana_perempuan INTEGER DEFAULT 0,
  baru_pindah_masuk_laki INTEGER DEFAULT 0,
  baru_pindah_masuk_perempuan INTEGER DEFAULT 0,
  diubah_oleh TEXT,
  diubah_pada TEXT DEFAULT (datetime('now')),
  UNIQUE(triwulan, kecamatan)
);

CREATE TABLE rekap_triwulan_masukan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  triwulan TEXT NOT NULL,
  nama_instansi TEXT NOT NULL,
  masukan_tanggapan TEXT,
  tindak_lanjut TEXT,
  keterangan TEXT,
  dicatat_oleh TEXT,
  dicatat_pada TEXT DEFAULT (datetime('now'))
);

CREATE TABLE sampel_tms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  periode TEXT NOT NULL,
  nama TEXT NOT NULL,
  nik TEXT,
  alamat TEXT,
  kelurahan TEXT,
  kecamatan TEXT NOT NULL,
  kategori TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Sesuai',
  keterangan TEXT,
  dientri_oleh TEXT,
  dientri_pada TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_sampel_tms_periode ON sampel_tms(periode);

CREATE TABLE sampel_ms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  periode TEXT NOT NULL,
  nama TEXT NOT NULL,
  nik TEXT,
  alamat TEXT,
  kelurahan TEXT,
  kecamatan TEXT NOT NULL,
  kategori TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Sesuai',
  keterangan TEXT,
  dientri_oleh TEXT,
  dientri_pada TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_sampel_ms_periode ON sampel_ms(periode);

CREATE TABLE sampel_dpb (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  periode TEXT NOT NULL,
  nama TEXT NOT NULL,
  nik TEXT,
  alamat TEXT,
  kelurahan TEXT,
  kecamatan TEXT NOT NULL,
  hasil TEXT NOT NULL DEFAULT 'Sesuai',
  kategori_tidak_sesuai TEXT,
  keterangan TEXT,
  dientri_oleh TEXT,
  dientri_pada TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_sampel_dpb_periode ON sampel_dpb(periode);
