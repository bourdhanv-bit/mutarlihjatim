#!/bin/bash
# scripts/apply-migrasi-rekap-triwulan-v3.sh
set -e

node -e "
const list = require('./scripts/kabkota-list.json');
list.forEach(k => console.log(k.kode));
" | while read -r kode; do
  DB_NAME="mutarlihjatim-$kode"
  echo "-- Migrasi rekap_triwulan v3 ke $DB_NAME --"
  turso db shell "$DB_NAME" < schema/schema-rekap-triwulan-migrasi-v3.sql
done

echo "Selesai, skema rekap_triwulan sudah diperbaiki di 38 database."
