#!/bin/bash
# scripts/apply-schema-all.sh
# Jalankan skema data (pemilih + uji petik) ke SEMUA 38 database kabkota sekaligus.

set -e

node -e "
const list = require('./scripts/kabkota-list.json');
list.forEach(k => console.log(k.kode));
" | while read -r kode; do
  DB_NAME="mutarlihjatim-$kode"
  echo "-- Apply schema ke $DB_NAME --"
  turso db shell "$DB_NAME" < schema/schema-kabkota-template.sql
done

echo "Selesai, skema sudah jalan di 38 database."
