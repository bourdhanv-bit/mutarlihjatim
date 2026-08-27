// src/labels.js
// Konstanta ini SAMA untuk semua 38 kab/kota (aturan resmi KPU/Bawaslu, bukan spesifik daerah),
// jadi cukup didefinisikan sekali di sini, tidak perlu duplikat per kabkota.

// ---- Modul Pemilih (bekas AWASI MUTARLIH) ----

export const TMS_LABELS = {
  "1": "Meninggal Dunia",
  "2": "Pindah Domisili",
  "3": "TNI/Polri Aktif",
  "4": "Belum Genap 17 Tahun",
  "5": "Data Ganda",
  "6": "Hak Pilih Dicabut",
  "7": "Bukan Penduduk/WNI",
};

export const DISABILITAS_LABELS = {
  "1": "Fisik",
  "2": "Intelektual",
  "3": "Mental",
  "4": "Sensorik Wicara",
  "5": "Sensorik Rungu",
  "6": "Sensorik Netra",
};

// ---- Modul Uji Petik (bekas uji-petik-malang) ----
// TNI dan Polri sengaja dipisah di sini (beda dari kode gabungan TMS_LABELS di atas),
// karena form resmi A-DPB5/7/8 memang minta keduanya terpisah.

export const TMS_KATEGORI = {
  meninggal: "Pemilih yang sudah meninggal dunia",
  ganda: "Pemilih ganda",
  belum17: "Pemilih belum genap 17 tahun dan belum kawin/menikah",
  pindah: "Pemilih pindah domisili",
  tni: "Pemilih menjadi prajurit TNI",
  polri: "Pemilih menjadi anggota Polri",
  wna: "Warga Negara Asing (WNA)",
  dicabut: "Hak politik dicabut oleh pengadilan (berkekuatan hukum tetap)",
};

export const MS_KATEGORI = {
  genap17: "Genap berumur 17 tahun pada saat PDPB",
  kawin: "Sudah kawin/menikah meski belum 17 tahun",
  tni_polri_sipil: "Berubah status dari TNI/Polri menjadi warga sipil",
  mantan_terpidana: "Mantan terpidana, selesai pidana tambahan pencabutan hak politik",
  pindah_masuk: "Pemilih pindah",
};

export const STATUS_OPTIONS = ["Sesuai", "Tidak Sesuai"];
