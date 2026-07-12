import { v7 as uuidv7 } from 'uuid'
import { eq } from 'drizzle-orm'
import type { Db } from './index'
import * as s from './schema'
import { hashPassword } from '../crypto/password'
import { CREDENTIAL_BACK_NAME, CREDENTIAL_FRONT_NAME } from '../../../shared/contracts/documents'

/**
 * Semillas idempotentes (docs/03): catálogos configurables, organización,
 * cuota 2026 y usuario administrador inicial. Se ejecutan en cada arranque;
 * solo insertan lo que falta, nunca sobreescriben lo editado por la usuaria.
 */
export function runSeeds(db: Db): void {
  seedOrganization(db)
  seedMemberStatuses(db)
  seedMembershipTypes(db)
  seedDocumentTypes(db)
  seedCredentialDocumentTypes(db)
  seedAnnualFees(db)
  seedSettings(db)
  seedAdminUser(db)
}

function seedOrganization(db: Db): void {
  const existing = db.select({ id: s.organization.id }).from(s.organization).limit(1).all()
  if (existing.length > 0) return
  db.insert(s.organization)
    .values({
      id: uuidv7(),
      name: 'Colegio de Especialistas en Valuación Profesional de Chiapas A.C.',
      shortName: 'CEVP Chiapas',
      city: 'Tapachula',
      state: 'Chiapas',
      country: 'México'
    })
    .run()
}

function seedMemberStatuses(db: Db): void {
  const seedRows = [
    { code: 'activo', name: 'Activo', sortOrder: 1 },
    { code: 'suspendido', name: 'Suspendido', sortOrder: 2 },
    { code: 'inactivo', name: 'Inactivo', sortOrder: 3 },
    { code: 'fallecido', name: 'Fallecido', sortOrder: 4 }
  ]
  for (const row of seedRows) {
    const found = db
      .select({ id: s.memberStatuses.id })
      .from(s.memberStatuses)
      .where(eq(s.memberStatuses.code, row.code))
      .all()
    if (found.length === 0) {
      db.insert(s.memberStatuses).values({ id: uuidv7(), ...row }).run()
    }
  }
}

function seedMembershipTypes(db: Db): void {
  const existing = db.select({ id: s.membershipTypes.id }).from(s.membershipTypes).limit(1).all()
  if (existing.length > 0) return
  db.insert(s.membershipTypes)
    .values({ id: uuidv7(), name: 'Titular', isFeeExempt: false, sortOrder: 1 })
    .run()
}

function seedDocumentTypes(db: Db): void {
  const existing = db.select({ id: s.documentTypes.id }).from(s.documentTypes).limit(1).all()
  if (existing.length > 0) return

  // Los 7 requeridos confirmados por Victor (docs/03 §4.3) + opcionales.
  const required = [
    { name: 'INE', hasExpiry: true },
    { name: 'Acta de nacimiento', hasExpiry: false },
    { name: 'CURP', hasExpiry: false },
    { name: 'Constancia de Situación Fiscal', hasExpiry: true },
    { name: 'Cédula profesional de Maestría', hasExpiry: false },
    { name: 'Registro catastral o Poder Judicial', hasExpiry: true },
    { name: 'Comprobante de domicilio', hasExpiry: true }
  ]
  const optional = [
    { name: 'Fotografía', hasExpiry: false, allowsMultiple: false },
    { name: 'Título Profesional', hasExpiry: false, allowsMultiple: false },
    { name: 'Cédula Profesional (Licenciatura)', hasExpiry: false, allowsMultiple: false },
    { name: 'RFC', hasExpiry: false, allowsMultiple: false },
    { name: 'Certificaciones', hasExpiry: true, allowsMultiple: true },
    { name: 'Diplomas', hasExpiry: false, allowsMultiple: true }
  ]

  let order = 1
  for (const doc of required) {
    db.insert(s.documentTypes)
      .values({ id: uuidv7(), name: doc.name, isRequired: true, hasExpiry: doc.hasExpiry, sortOrder: order++ })
      .run()
  }
  for (const doc of optional) {
    db.insert(s.documentTypes)
      .values({
        id: uuidv7(),
        name: doc.name,
        isRequired: false,
        hasExpiry: doc.hasExpiry,
        allowsMultiple: doc.allowsMultiple,
        sortOrder: order++
      })
      .run()
  }
}

/**
 * Tipos para el visor de credencial (E-05 ampliado 2026-07-12): Victor diseña la
 * credencial en Illustrator y solo se sube; el sistema no genera el layout.
 * Función aparte (no dentro de seedDocumentTypes) para que también llegue a
 * bases de datos que ya corrieron esa semilla antes de que existiera esta.
 */
function seedCredentialDocumentTypes(db: Db): void {
  const names = [CREDENTIAL_FRONT_NAME, CREDENTIAL_BACK_NAME]
  const maxOrder = db
    .select({ sortOrder: s.documentTypes.sortOrder })
    .from(s.documentTypes)
    .all()
    .reduce((max, r) => Math.max(max, r.sortOrder), 0)
  let order = maxOrder + 1
  for (const name of names) {
    const found = db.select({ id: s.documentTypes.id }).from(s.documentTypes).where(eq(s.documentTypes.name, name)).all()
    if (found.length === 0) {
      db.insert(s.documentTypes)
        .values({ id: uuidv7(), name, isRequired: false, hasExpiry: false, allowsMultiple: false, sortOrder: order++ })
        .run()
    }
  }
}

function seedAnnualFees(db: Db): void {
  const existing = db.select({ id: s.annualFees.id }).from(s.annualFees).limit(1).all()
  if (existing.length > 0) return
  // Cuota general 2026 observada en el padrón real: $1,500.00 (en centavos).
  db.insert(s.annualFees).values({ id: uuidv7(), year: 2026, amountCents: 150000 }).run()
}

function seedSettings(db: Db): void {
  const defaults: Record<string, unknown> = {
    member_number_format: 'M-{seq:3}',
    next_member_seq: 1,
    first_control_year: 2026, // no generar adeudos de años previos al sistema
    auto_lock_minutes: 10,
    next_receipt_folio: 1
  }
  for (const [key, value] of Object.entries(defaults)) {
    const found = db.select({ key: s.settings.key }).from(s.settings).where(eq(s.settings.key, key)).all()
    if (found.length === 0) {
      db.insert(s.settings).values({ key, value: JSON.stringify(value) }).run()
    }
  }
}

function seedAdminUser(db: Db): void {
  const existing = db.select({ id: s.users.id }).from(s.users).limit(1).all()
  if (existing.length > 0) return
  // Credenciales iniciales de desarrollo; el asistente de primera ejecución (M5)
  // obliga a cambiarlas antes de usar el sistema con datos reales.
  db.insert(s.users)
    .values({
      id: uuidv7(),
      fullName: 'Administrador',
      username: 'admin',
      passwordHash: hashPassword('admin'),
      role: 'admin',
      mustChangePassword: true
    })
    .run()
}
