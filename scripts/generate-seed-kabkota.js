// scripts/generate-seed-kabkota.js
// Cara pakai:
//   node scripts/generate-seed-kabkota.js > schema/seed-kabkota.sql
//   npx wrangler d1 execute mutarlihjatim-central --file=schema/seed-kabkota.sql

const list = require("./kabkota-list.json");

let out = "";
for (const k of list) {
  const nama = k.nama.replace(/'/g, "''");
  out += `INSERT INTO kabkota (kode, nama, jenis) VALUES ('${k.kode}', '${nama}', '${k.jenis}');\n`;
}
console.log(out);
