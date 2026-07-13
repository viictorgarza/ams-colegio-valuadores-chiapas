#!/bin/bash
# Exporta los datos del AMS de escritorio (ams.db) a un import.sql listo para
# cargarse en la base D1 de la nube con:
#   npx wrangler d1 execute ams --remote --file=import.sql
#
# Uso:  ./exportar-desde-escritorio.sh /ruta/a/ams.db [salida.sql]
#
# Qué hace:
#  - Borra las semillas de la nube (catálogos/organización/cuota/settings) para
#    reemplazarlas por las del escritorio, conservando los UUID originales
#    (los miembros referencian esos catálogos por id).
#  - Exporta miembros, historial de estados, cuotas, pagos, eventos, asambleas
#    y asistencias tal cual.
#  - Los usuarios del escritorio se importan SOLO para integridad referencial
#    (auditoría/creado-por): quedan desactivados y con usuario renombrado
#    "@escritorio" — sus contraseñas scrypt no funcionan en la nube (PBKDF2).
#    El acceso a la nube es con las cuentas creadas allá (admin inicial).
#  - Documentos/archivos NO se exportan (fase 2 en la nube).
set -euo pipefail

DB="${1:?Uso: $0 /ruta/a/ams.db [salida.sql]}"
OUT="${2:-import.sql}"

sql() { sqlite3 "$DB" "$1"; }

{
  echo "-- Generado por exportar-desde-escritorio.sh"
  echo "PRAGMA defer_foreign_keys = true;"

  # Reemplazar semillas de la nube por los datos reales del escritorio.
  echo "DELETE FROM attendance_records;"
  echo "DELETE FROM assemblies;"
  echo "DELETE FROM payments;"
  echo "DELETE FROM annual_fees;"
  echo "DELETE FROM member_status_history;"
  echo "DELETE FROM members;"
  echo "DELETE FROM member_statuses;"
  echo "DELETE FROM membership_types;"
  echo "DELETE FROM organization;"
  echo "DELETE FROM settings WHERE key IN ('member_number_format','next_member_seq','first_control_year','next_receipt_folio');"
  echo "DELETE FROM users WHERE username LIKE '%@escritorio';"

  sqlite3 "$DB" <<'EOSQL'
.mode insert organization
SELECT id, name, short_name, rfc, street, city, state, zip, country, phone, email, website, fiscal_notes, created_at, updated_at FROM organization;
.mode insert membership_types
SELECT id, name, description, is_fee_exempt, sort_order, is_active, created_at, updated_at FROM membership_types;
.mode insert member_statuses
SELECT id, code, name, sort_order, is_active FROM member_statuses;
.mode insert users
SELECT id, full_name, username || '@escritorio', 'importado$sin-acceso', role, 0, 0, last_login_at, created_at, updated_at, deleted_at FROM users;
.mode insert members
SELECT id, member_number, title, given_names, paternal_surname, maternal_surname, full_name, curp, rfc, email, phone, phone_home, street, city, state, zip, university, degree, specialty, masters, doctorate, company, position, is_perito, perito_number, membership_type_id, status_id, joined_at, observations, created_at, updated_at, deleted_at FROM members;
.mode insert member_status_history
SELECT id, member_id, status_id, changed_at, reason, changed_by FROM member_status_history;
.mode insert annual_fees
SELECT id, year, membership_type_id, amount_cents, notes, created_at, updated_at FROM annual_fees;
.mode insert payments
SELECT id, member_id, year, kind, amount_cents, paid_at, method, concept, reference, receipt_folio, observations, created_by, created_at, updated_at, deleted_at FROM payments;
.mode insert events
SELECT id, title, event_type, starts_at, ends_at, location, notes, created_by, created_at, updated_at, deleted_at FROM events;
.mode insert assemblies
SELECT id, date, title, notes, created_by, created_at, updated_at, deleted_at FROM assemblies;
.mode insert attendance_records
SELECT id, assembly_id, member_id, present, marked_at, created_at, updated_at FROM attendance_records;
EOSQL

  # Settings que sí viajan (contadores y formato); el resto (rutas locales,
  # llaves antiguas) se queda en el escritorio a propósito.
  sqlite3 "$DB" <<'EOSQL'
.mode insert settings
SELECT key, value FROM settings WHERE key IN ('member_number_format','next_member_seq','first_control_year','next_receipt_folio');
EOSQL
} > "$OUT"

echo "Listo: $OUT ($(grep -c 'INSERT INTO' "$OUT") INSERTs)."
echo "Cárgalo con: cd cloud/server && npx wrangler d1 execute ams --remote --file=$OUT"
