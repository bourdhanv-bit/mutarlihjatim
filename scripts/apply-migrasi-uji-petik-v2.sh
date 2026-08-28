#!/bin/bash
# scripts/apply-migrasi-uji-petik-v2.sh
# Khusus untuk 38 database yang SUDAH dibuat sebelumnya dengan schema-kabkota-template.sql
# versi pertama (uji petik masih salah desain). Script ini menjalankan migrasi (drop + recreate
# tabel uji petik saja, tabel pemilih tidak disentuh) ke semua 38 database sekaligus.
# Aman dijalankan karena tabel uji petik masih kosong di semua database (belum ada data).

set -e

node -e "
const list = require('./scripts/kabkota-list.json');
list.forEach(k => console.log(k.kode));
" | while read -r kode; do
  DB_NAME="mutarlihjatim-$kode"
  echo "-- Migrasi uji petik ke $DB_NAME --"
  turso db shell "$DB_NAME" < schema/schema-uji-petik-migrasi-v2.sql
done

echo "Selesai, skema uji petik sudah diperbarui di 38 database."
