#!/bin/bash
# scripts/create-turso-databases.sh
# Perlu Turso CLI sudah terpasang & login: curl -sSfL https://get.tur.so/install.sh | bash
# lalu `turso auth login`. Jalankan dari root folder project.
#
# Hasil: 39 database Turso dibuat, plus file schema/update-kredensial-kabkota.sql yang berisi
# UPDATE statement untuk mengisi turso_url + turso_token tiap kabkota di database central.
# Kredensial database CENTRAL sendiri dicetak terpisah di akhir -- itu yang perlu Anda tempel
# manual ke Vercel Environment Variables (TURSO_CENTRAL_URL, TURSO_CENTRAL_AUTH_TOKEN).

set -e
OUT_SQL="schema/update-kredensial-kabkota.sql"

echo "== Membuat database central =="
turso db create mutarlihjatim-central
CENTRAL_URL=$(turso db show mutarlihjatim-central --url)
CENTRAL_TOKEN=$(turso db tokens create mutarlihjatim-central)

echo "" > "$OUT_SQL"
echo "-- Auto-generated oleh scripts/create-turso-databases.sh" >> "$OUT_SQL"

echo ""
echo "== Membuat 38 database kab/kota =="
node -e "
const list = require('./scripts/kabkota-list.json');
list.forEach(k => console.log(k.kode));
" | while read -r kode; do
  DB_NAME="mutarlihjatim-$kode"
  echo ""
  echo "-- $DB_NAME --"
  turso db create "$DB_NAME"
  URL=$(turso db show "$DB_NAME" --url)
  TOKEN=$(turso db tokens create "$DB_NAME")
  echo "UPDATE kabkota SET turso_url = '$URL', turso_token = '$TOKEN' WHERE kode = '$kode';" >> "$OUT_SQL"
done

echo ""
echo "======================================================================"
echo "SELESAI. Langkah selanjutnya:"
echo "1. Jalankan schema central:"
echo "   turso db shell mutarlihjatim-central < schema/schema-central.sql"
echo "2. Isi master 38 kabkota:"
echo "   turso db shell mutarlihjatim-central < schema/seed-kabkota.sql"
echo "3. Isi kredensial tiap kabkota ke tabel central (baru saja digenerate):"
echo "   turso db shell mutarlihjatim-central < $OUT_SQL"
echo "4. Jalankan skema data ke tiap 38 database kabkota (lihat scripts/apply-schema-all.sh)"
echo "5. Tempel ke Vercel Environment Variables:"
echo "   TURSO_CENTRAL_URL=$CENTRAL_URL"
echo "   TURSO_CENTRAL_AUTH_TOKEN=$CENTRAL_TOKEN"
echo "======================================================================"
