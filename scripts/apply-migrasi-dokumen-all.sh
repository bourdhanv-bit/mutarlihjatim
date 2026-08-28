#!/bin/bash
# scripts/apply-migrasi-dokumen-all.sh
set -e

node -e "
const list = require('./scripts/kabkota-list.json');
list.forEach(k => console.log(k.kode));
" | while read -r kode; do
  DB_NAME="mutarlihjatim-$kode"
  echo "-- Migrasi dokumen_pengawasan ke $DB_NAME --"
  turso db shell "$DB_NAME" < schema/schema-dokumen-migrasi-v1.sql
done

echo "Selesai, tabel dokumen_pengawasan sudah ada di 38 database."
