// scripts/create-superadmin.cjs
// Akun ini SENGAJA dibuat lewat script terpisah (bukan generate-seed-users.cjs) supaya tidak
// tercampur dengan daftar 39 user standar (38 kab/kota + 1 provinsi). Role 'super_admin' bisa
// "masuk sebagai" kab/kota atau provinsi manapun lewat menu di dalam aplikasi, tanpa perlu
// password masing-masing daerah.
//
// Cara pakai:
//   node scripts/create-superadmin.cjs > schema/seed-superadmin.sql
//   turso db shell mutarlihjatim-central < schema/seed-superadmin.sql

const USERNAME = "super-admin";
const PASSWORD = "1234567890)(*&^%$#@!";
const PBKDF2_ITERATIONS = 100000;

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

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

async function main() {
  const hash = await hashPassword(PASSWORD);
  console.log(
    `INSERT INTO users (username, password_hash, nama, role, kabkota_id) VALUES ('${USERNAME}', '${hash}', 'Super Admin', 'super_admin', NULL);`
  );
}

main();
