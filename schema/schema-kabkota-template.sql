-- schema-kabkota-template.sql
-- Dijalankan SEKALI PER DATABASE kab/kota (jadi 38x total, satu per daerah).
-- Contoh: npx wrangler d1 execute mutarlihjatim-kab-malang --file=schema/schema-kabkota-template.sql
-- (atau via Turso: turso db shell mutarlihjatim-kab-malang < schema/schema-kabkota-template.sql)
--
-- v2: bagian Uji Petik ditulis ulang total supaya kolomnya cocok dengan logika asli aplikasi
-- Uji Petik (kolom rata per kategori L/P, bukan blob data_json seperti draft pertama) --
-- withTotals(), carry-forward triwulan, dan rekap kategori semuanya bergantung pada nama
-- kolom persis seperti ini.

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
  disabilitas TEXT,
  ektp TEXT,
  keterangan TEXT,
  sumber TEXT,
  tps TEXT,
  kode_tms TEXT,
  tanggal_tms TEXT,
  tanggal_input TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_pemilih_nik ON pemilih(nik);
CREATE INDEX idx_pemilih_kecamatan ON pemilih(kecamatan);
CREATE INDEX idx_pemilih_kode_tms ON pemilih(kode_tms);

CREATE TABLE tms_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pemilih_id INTEGER NOT NULL REFERENCES pemilih(id),
  kode_tms_lama TEXT,
  kode_tms_baru TEXT,
  username TEXT NOT NULL,
  dicatat_pada TEXT DEFAULT (datetime('now'))
);

CREATE TABLE ubah_data_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pemilih_id INTEGER NOT NULL REFERENCES pemilih(id),
  field TEXT NOT NULL,
  nilai_lama TEXT,
  nilai_baru TEXT,
  username TEXT NOT NULL,
  dicatat_pada TEXT DEFAULT (datetime('now'))
);

CREATE TABLE snapshot_bulanan (
  bulan TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  dibuat_pada TEXT DEFAULT (datetime('now'))
);

-- ================= MODUL UJI PETIK (bekas uji-petik-malang) =================

-- Checklist 40 prosedur A-DPB1 per triwulan
CREATE TABLE checklist_jawaban (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  triwulan TEXT NOT NULL,          -- format 'YYYY-Q1', dst
  nomor_item INTEGER NOT NULL,
  jawaban TEXT,
  keterangan TEXT,
  diisi_oleh TEXT,
  diisi_pada TEXT DEFAULT (datetime('now')),
  UNIQUE(triwulan, nomor_item)
);

-- Rekap triwulan A-DPB2: PDPB Awal, 8 kategori TMS, 5 kategori Pemilih Baru,
-- masing-masing punya kolom Laki-laki/Perempuan terpisah. "Hasil Akhir" TIDAK
-- disimpan di sini -- selalu dihitung on-the-fly (Awal - Total TMS + Total Baru).
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

-- Log Masukan/Tanggapan Pleno A-DPB3
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

-- Sampel TMS (A-DPB5), rekap ke A-DPB4 per bulan
CREATE TABLE sampel_tms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  periode TEXT NOT NULL,           -- format 'YYYY-MM'
  nama TEXT NOT NULL,
  nik TEXT,
  alamat TEXT,
  kelurahan TEXT,
  kecamatan TEXT NOT NULL,
  kategori TEXT NOT NULL,          -- salah satu dari TMS_KATEGORI (lib/labels.js)
  status TEXT NOT NULL DEFAULT 'Sesuai',  -- 'Sesuai' | 'Tidak Sesuai'
  keterangan TEXT,
  dientri_oleh TEXT,
  dientri_pada TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_sampel_tms_periode ON sampel_tms(periode);

-- Sampel Pemilih Baru (A-DPB7), rekap ke A-DPB6 per bulan
CREATE TABLE sampel_ms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  periode TEXT NOT NULL,
  nama TEXT NOT NULL,
  nik TEXT,
  alamat TEXT,
  kelurahan TEXT,
  kecamatan TEXT NOT NULL,
  kategori TEXT NOT NULL,          -- salah satu dari MS_KATEGORI (lib/labels.js)
  status TEXT NOT NULL DEFAULT 'Sesuai',
  keterangan TEXT,
  dientri_oleh TEXT,
  dientri_pada TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_sampel_ms_periode ON sampel_ms(periode);

-- Sampel DPB (A-DPB8) per bulan
CREATE TABLE sampel_dpb (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  periode TEXT NOT NULL,
  nama TEXT NOT NULL,
  nik TEXT,
  alamat TEXT,
  kelurahan TEXT,
  kecamatan TEXT NOT NULL,
  hasil TEXT NOT NULL DEFAULT 'Sesuai',   -- 'Sesuai' | 'Tidak Sesuai'
  kategori_tidak_sesuai TEXT,             -- diisi dari TMS_KATEGORI kalau hasil Tidak Sesuai
  keterangan TEXT,
  dientri_oleh TEXT,
  dientri_pada TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_sampel_dpb_periode ON sampel_dpb(periode);
