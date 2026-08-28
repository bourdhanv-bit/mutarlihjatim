// scripts/generate-dummy-pemilih.cjs
// Generate data dummy pemilih untuk 1 kabkota, output berupa SQL INSERT siap pakai.
//
// Cara pakai (satu kabkota):
//   node scripts/generate-dummy-pemilih.cjs kab-malang > /tmp/dummy.sql
//   turso db shell mutarlihjatim-kab-malang < /tmp/dummy.sql
//
// Atau langsung ke SEMUA 38 kabkota sekaligus, lihat scripts/apply-dummy-pemilih-all.sh
//
// CATATAN JUJUR: NIK/NKK di sini FIKTIF (16 digit acak berpola, bukan nomor identitas asli
// siapa pun) -- jangan dipakai selain untuk uji coba aplikasi. Nama desa/kelurahan yang dipakai
// adalah desa nyata di kecamatan ibu kota kabupaten/kota masing-masing, tapi belum diverifikasi
// satu-satu ke gazetteer resmi BPS untuk semua 38 daerah -- anggap representatif untuk uji coba,
// bukan data administratif final.

const kode = process.argv[2];
if (!kode) {
  console.error("Pemakaian: node scripts/generate-dummy-pemilih.cjs <kode-kabkota>");
  process.exit(1);
}

// kecamatan ibu kota + beberapa desa/kelurahan nyata di kecamatan itu, per kabupaten/kota
const KABKOTA_DATA = {
  "kab-bangkalan": { kecamatan: "Bangkalan", desa: ["Mlajah", "Pangeranan", "Demangan", "Kraton", "Pejagan"] },
  "kab-banyuwangi": { kecamatan: "Banyuwangi", desa: ["Penataban", "Kepatihan", "Kertosari", "Karangrejo", "Tukangkayu"] },
  "kab-blitar": { kecamatan: "Kanigoro", desa: ["Kaligambir", "Sawentar", "Karangbendo", "Tlogo", "Gogodeso"] },
  "kab-bojonegoro": { kecamatan: "Bojonegoro", desa: ["Ledok Wetan", "Ledok Kulon", "Sumbang", "Kadipaten", "Jetak"] },
  "kab-bondowoso": { kecamatan: "Bondowoso", desa: ["Dabasah", "Nangkaan", "Kotakulon", "Blindungan", "Pancoran"] },
  "kab-gresik": { kecamatan: "Gresik", desa: ["Pekelingan", "Kroman", "Sukorame", "Karangturi", "Tlogopojok"] },
  "kab-jember": { kecamatan: "Sumbersari", desa: ["Sumbersari", "Tegalgede", "Kebonsari", "Karangrejo", "Kranjingan"] },
  "kab-jombang": { kecamatan: "Jombang", desa: ["Jombatan", "Kepanjen", "Sengon", "Kaliwungu", "Candimulyo"] },
  "kab-kediri": { kecamatan: "Ngadiluwih", desa: ["Ngadiluwih", "Banjarejo", "Purwokerto", "Tiron", "Rembang"] },
  "kab-lamongan": { kecamatan: "Lamongan", desa: ["Jetis", "Sidokumpul", "Tumenggungan", "Sukorejo", "Sidoharjo"] },
  "kab-lumajang": { kecamatan: "Lumajang", desa: ["Jogoyudan", "Ditotrunan", "Rogotrunan", "Kepuharjo", "Citrodiwangsan"] },
  "kab-madiun": { kecamatan: "Mejayan", desa: ["Mejayan", "Bangunsari", "Kaibon", "Pandean", "Kare"] },
  "kab-magetan": { kecamatan: "Magetan", desa: ["Magetan", "Tinap", "Kepolorejo", "Bulukerto", "Selosari"] },
  "kab-malang": { kecamatan: "Kepanjen", desa: ["Kepanjen", "Ardirejo", "Dilem", "Panarukan", "Jatirejoyoso"] },
  "kab-mojokerto": { kecamatan: "Mojosari", desa: ["Mojosari", "Sawotratap", "Modongan", "Seduri", "Wunut"] },
  "kab-nganjuk": { kecamatan: "Nganjuk", desa: ["Kartoharjo", "Payaman", "Werungotok", "Mangundikaran", "Ganungkidul"] },
  "kab-ngawi": { kecamatan: "Ngawi", desa: ["Beran", "Ketanggi", "Kartoharjo", "Pelem", "Karangtengah"] },
  "kab-pacitan": { kecamatan: "Pacitan", desa: ["Sidoharjo", "Ploso", "Baleharjo", "Bangunsari", "Sirnoboyo"] },
  "kab-pamekasan": { kecamatan: "Pamekasan", desa: ["Jungcangcang", "Patemon", "Bugih", "Gladak Anyar", "Barurambat"] },
  "kab-pasuruan": { kecamatan: "Bangil", desa: ["Kalirejo", "Kersikan", "Kidul Dalem", "Pogar", "Latek"] },
  "kab-ponorogo": { kecamatan: "Ponorogo", desa: ["Nologaten", "Tonatan", "Cokromenggalan", "Mangkujayan", "Kertosari"] },
  "kab-probolinggo": { kecamatan: "Dringu", desa: ["Dringu", "Tarokan", "Sumberkerang", "Kalisalam", "Warujinggo"] },
  "kab-sampang": { kecamatan: "Sampang", desa: ["Rongtengah", "Gunungsekar", "Polagan", "Karangdalem", "Banyuanyar"] },
  "kab-sidoarjo": { kecamatan: "Sidoarjo", desa: ["Sidokare", "Lemahputro", "Pucang", "Sekardangan", "Magersari"] },
  "kab-situbondo": { kecamatan: "Situbondo", desa: ["Dawuhan", "Patokan", "Mimbaan", "Kotakan", "Ardirejo"] },
  "kab-sumenep": { kecamatan: "Sumenep", desa: ["Pajagalan", "Kebonagung", "Bangselok", "Pangarangan", "Kolor"] },
  "kab-trenggalek": { kecamatan: "Trenggalek", desa: ["Ngantru", "Surodakan", "Sumbergedong", "Kelutan", "Sukorejo"] },
  "kab-tuban": { kecamatan: "Tuban", desa: ["Latsari", "Kutorejo", "Sidorejo", "Ronggomulyo", "Baturetno"] },
  "kab-tulungagung": { kecamatan: "Tulungagung", desa: ["Kenayan", "Kepatihan", "Bago", "Panggungrejo", "Karangwaru"] },
  "kota-batu": { kecamatan: "Batu", desa: ["Sisir", "Songgokerto", "Temas", "Ngaglik", "Sidomulyo"] },
  "kota-blitar": { kecamatan: "Sukorejo", desa: ["Sukorejo", "Turi", "Bendo", "Pakunden", "Tanggung"] },
  "kota-kediri": { kecamatan: "Kota", desa: ["Ngronggo", "Dandangan", "Setonopande", "Bandarlor", "Balowerti"] },
  "kota-madiun": { kecamatan: "Manguharjo", desa: ["Manguharjo", "Pandean", "Kelun", "Kejuron", "Nambanganlor"] },
  "kota-malang": { kecamatan: "Klojen", desa: ["Klojen", "Kasin", "Oro-oro Dowo", "Kauman", "Sukoharjo"] },
  "kota-mojokerto": { kecamatan: "Magersari", desa: ["Magersari", "Balongsari", "Gununggedangan", "Kedundung", "Wates"] },
  "kota-pasuruan": { kecamatan: "Panggungrejo", desa: ["Panggungrejo", "Petahunan", "Trajeng", "Tamba'an", "Kandangsapi"] },
  "kota-probolinggo": { kecamatan: "Kanigaran", desa: ["Kanigaran", "Kebonsari Wetan", "Sukabumi", "Curahgrinting", "Tisnonegaran"] },
  "kota-surabaya": { kecamatan: "Gubeng", desa: ["Gubeng", "Airlangga", "Baratajaya", "Kertajaya", "Pucangsewu"] },
};

const NAMA_L = ["Ahmad Fauzi", "Budi Santoso", "Slamet Riyadi", "Agus Salim", "Bambang Prasetyo", "Hendra Wijaya", "Sutrisno", "Eko Purnomo", "Dedi Kurniawan", "Imam Syafi'i", "Rudi Hartono", "Wahyu Setiawan", "Yusuf Hidayat", "Joko Susilo", "Andi Firmansyah"];
const NAMA_P = ["Siti Aminah", "Dewi Lestari", "Sri Wahyuni", "Nur Hasanah", "Rina Marlina", "Fitriani", "Wahyu Ningsih", "Endang Sulastri", "Yuli Astuti", "Ratna Sari", "Indah Permata", "Umi Kalsum", "Lilis Suryani", "Maryam Salsabila", "Wiwik Handayani"];
const JALAN = ["Jl. Merdeka", "Jl. Diponegoro", "Jl. Ahmad Yani", "Jl. Sudirman", "Jl. Veteran", "Jl. Pahlawan", "Jl. Kartini", "Jl. Melati", "Jl. Anggrek", "Jl. Flamboyan"];
const STS_KAWIN = ["Kawin", "Belum Kawin", "Kawin", "Kawin", "Cerai Hidup", "Kawin", "Belum Kawin", "Kawin"];
const DISABILITAS_CODES = ["", "", "", "", "", "", "", "", "1", "3", "5"]; // ~mostly kosong, sesekali terisi
const TMS_CODES = ["", "", "", "", "", "", "", "", "", "1", "4"]; // ~mostly MS, sesekali TMS

function pick(arr, seed) { return arr[seed % arr.length]; }
function pad(n, len) { return String(n).padStart(len, "0"); }

function randomNik(seed) {
  // 16 digit FIKTIF, bukan NIK asli siapa pun -- hanya untuk uji coba aplikasi.
  return "35" + pad((seed * 137) % 100, 2) + pad((seed * 7) % 100, 2) + pad(900000000 + seed * 3131, 10);
}
function randomNkk(seed) {
  return "35" + pad((seed * 91) % 100, 2) + pad((seed * 13) % 100, 2) + pad(800000000 + seed * 2221, 10);
}
function randomTanggalLahir(seed) {
  const year = 1955 + (seed * 3) % 50;
  const month = 1 + (seed % 12);
  const day = 1 + (seed * 5) % 28;
  return `${pad(day, 2)}/${pad(month, 2)}/${year}`;
}

const info = KABKOTA_DATA[kode];
if (!info) {
  console.error(`Kode kabkota '${kode}' tidak dikenal di daftar KABKOTA_DATA.`);
  process.exit(1);
}

const JUMLAH = 12; // 10-15 baris per kabkota
let out = "";
for (let i = 0; i < JUMLAH; i++) {
  const seed = i + 1;
  const isL = i % 2 === 0;
  const nama = pick(isL ? NAMA_L : NAMA_P, seed).replace(/'/g, "''");
  const kelurahan = pick(info.desa, seed);
  const alamat = `${pick(JALAN, seed)} No.${1 + (seed * 4) % 30}`;
  const rt = pad(1 + (seed % 15), 2);
  const rw = pad(1 + (seed % 8), 2);
  const tps = 1 + (seed % 6);
  const disabilitas = pick(DISABILITAS_CODES, seed * 17);
  const kodeTms = pick(TMS_CODES, seed * 23);
  const nik = randomNik(seed);
  const nkk = randomNkk(seed);
  const tglLahir = randomTanggalLahir(seed);
  const stsKawin = pick(STS_KAWIN, seed);

  out += `INSERT INTO pemilih (kecamatan, kelurahan, nkk, nik, nama, tempat_lahir, tanggal_lahir, sts_kawin, kelamin, alamat, rt, rw, disabilitas, ektp, keterangan, sumber, tps, kode_tms, tanggal_tms, tanggal_input) VALUES ('${info.kecamatan}', '${kelurahan}', '${nkk}', '${nik}', '${nama}', '${info.kecamatan}', '${tglLahir}', '${stsKawin}', '${isL ? "L" : "P"}', '${alamat}', '${rt}', '${rw}', ${disabilitas ? `'${disabilitas}'` : "NULL"}, 'S', NULL, 'PDPB', '${tps}', ${kodeTms ? `'${kodeTms}'` : "NULL"}, ${kodeTms ? "datetime('now')" : "NULL"}, datetime('now'));\n`;
}

process.stdout.write(out);
