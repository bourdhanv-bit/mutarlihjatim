-- schema-rekap-triwulan-migrasi-v3.sql
-- Perbaikan skema rekap_triwulan supaya sesuai form resmi A-DPB2 (dikonfirmasi dari template
-- xlsx asli Bawaslu Provinsi Jatim). Versi sebelumnya (v2) salah asumsi -- form resmi TIDAK
-- memecah PDPB Awal/TMS/Pemilih Baru per Laki-laki/Perempuan, hanya Hasil Akhir yang dipecah,
-- dan itu pun diinput langsung (bukan hasil hitungan aplikasi).
-- Aman dijalankan karena tabel ini kemungkinan masih kosong/data uji coba saja.

DROP TABLE IF EXISTS rekap_triwulan;

CREATE TABLE rekap_triwulan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  triwulan TEXT NOT NULL,
  kecamatan TEXT NOT NULL,
  pdpb_awal INTEGER DEFAULT 0,
  tms_meninggal INTEGER DEFAULT 0,
  tms_ganda INTEGER DEFAULT 0,
  tms_belum17 INTEGER DEFAULT 0,
  tms_pindah INTEGER DEFAULT 0,
  tms_tni INTEGER DEFAULT 0,
  tms_polri INTEGER DEFAULT 0,
  tms_wna INTEGER DEFAULT 0,
  tms_dicabut INTEGER DEFAULT 0,
  baru_genap17 INTEGER DEFAULT 0,
  baru_kawin INTEGER DEFAULT 0,
  baru_tni_polri_sipil INTEGER DEFAULT 0,
  baru_mantan_terpidana INTEGER DEFAULT 0,
  baru_pindah_masuk INTEGER DEFAULT 0,
  hasil_akhir_laki INTEGER DEFAULT 0,
  hasil_akhir_perempuan INTEGER DEFAULT 0,
  diubah_oleh TEXT,
  diubah_pada TEXT DEFAULT (datetime('now')),
  UNIQUE(triwulan, kecamatan)
);
