#!/bin/bash
# scripts/apply-dummy-pemilih-all.sh
# Isi 12 baris data pemilih dummy ke SEMUA 38 database kabkota sekaligus, untuk uji coba.
# Aman dijalankan berulang -- setiap kali dijalankan akan menambah baris baru lagi (bukan
# menimpa), jadi kalau sudah pernah dijalankan sebelumnya, jangan dijalankan dua kali kecuali
# memang mau data dummy-nya berlipat.

set -e

node -e "
const list = require('./scripts/kabkota-list.json');
list.forEach(k => console.log(k.kode));
" | while read -r kode; do
  DB_NAME="mutarlihjatim-$kode"
  echo "-- Isi data dummy ke $DB_NAME --"
  node scripts/generate-dummy-pemilih.cjs "$kode" | turso db shell "$DB_NAME"
done

echo "Selesai, 38 database sudah terisi data dummy (12 pemilih per kabkota)."
