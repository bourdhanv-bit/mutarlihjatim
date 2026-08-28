// scripts/generate-seed-users.js
// Generate SQL INSERT untuk 39 user (38 admin_kabkota + 1 admin_provinsi), semua pakai
// password yang sama (diset di PASSWORD_SERAGAM di bawah -- sengaja ditulis di sini, bukan
// argumen command line, supaya karakter spesial (!@#$%^&*()) tidak perlu di-escape lewat shell).
//
// Skema username: kode kabkota apa adanya (mis. "kab-malang", "kota-surabaya"), dan
// "admin-provinsi" untuk akun provinsi. Ganti PASSWORD_SERAGAM dan skema username di bawah
// kalau perlu, lalu jalankan:
//
//   node scripts/generate-seed-users.js > schema/seed-users.sql
//   turso db shell mutarlihjatim-central < schema/seed-users.sql
//
// PENTING: setelah user bisa login, sangat disarankan tiap kab/kota ganti password
// masing-masing (belum ada fitur ganti password di skeleton ini, lihat catatan di README).

const kabkotaList = require("./kabkota-list.json");

const PASSWORD_SERAGAM = "1234567890!@#$%^&*()";
const PBKDF2_ITERATIONS = 100000;

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Sama persis dengan hashPassword() di lib/auth.js, dipanggil di Node (bukan Edge Runtime),
// pakai Web Crypto global yang sudah tersedia native sejak Node 19+.
async function hashPassword(password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return `${toHex(salt)}:${toHex(derivedBits)}`;
}

function escapeSql(str) {
  return str.replace(/'/g, "''");
}

async function main() {
  let out = "";

  // Akun provinsi -- kabkota_id NULL
  const hashProvinsi = await hashPassword(PASSWORD_SERAGAM);
  out += `INSERT INTO users (username, password_hash, nama, role, kabkota_id) VALUES ('admin-provinsi', '${escapeSql(hashProvinsi)}', 'Admin Provinsi Jatim', 'admin_provinsi', NULL);\n`;

  // 38 akun kabkota -- kabkota_id diambil lewat subquery berdasarkan kode
  for (const k of kabkotaList) {
    const hash = await hashPassword(PASSWORD_SERAGAM);
    const username = k.kode; // 'kab-malang', 'kota-surabaya', dst
    const nama = `Admin ${k.nama}`;
    out += `INSERT INTO users (username, password_hash, nama, role, kabkota_id) VALUES ('${username}', '${escapeSql(hash)}', '${escapeSql(nama)}', 'admin_kabkota', (SELECT id FROM kabkota WHERE kode = '${k.kode}'));\n`;
  }

  console.log(out);
}

main();
