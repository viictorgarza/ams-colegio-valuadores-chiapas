/**
 * Prueba de humo del núcleo (sin interfaz): migraciones, semillas, autenticación,
 * FTS y auditoría contra una base temporal. Se ejecuta con `npm run smoke`
 * (bajo el Node de Electron, para usar el binario nativo correcto).
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { count, eq } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import { v7 as uuidv7 } from 'uuid'
import { initDb, closeDb } from '../src/main/core/db'
import { runSeeds } from '../src/main/core/db/seeds'
import * as s from '../src/main/core/db/schema'
import { login, logout, me } from '../src/main/modules/users/users.service'
import { register as registerAudit } from '../src/main/modules/audit'
import {
  changeStatus,
  createMember,
  listMembers,
  softDeleteMember,
  updateMember
} from '../src/main/modules/members/members.service'
import {
  annuitiesByYear,
  createPayment,
  setAnnualFee
} from '../src/main/modules/payments/payments.service'
import {
  getCredential,
  getMemberExpediente,
  setExpiry,
  setPhysical,
  setStatus as setDocumentStatus,
  upcomingExpirations
} from '../src/main/modules/documents/documents.service'

const dir = mkdtempSync(join(tmpdir(), 'ams-smoke-'))
try {
  const db = initDb({ dataDir: dir, migrationsDir: join(process.cwd(), 'drizzle') })
  runSeeds(db)
  runSeeds(db) // idempotencia: correr dos veces no duplica nada
  registerAudit() // como en el arranque real: audit escucha antes de que nadie emita

  const rows = (table: SQLiteTable): number => db.select({ n: count() }).from(table).get()?.n ?? 0

  // — Semillas
  const org = db.select().from(s.organization).all()
  assert.equal(org.length, 1, 'debe existir exactamente una organización')
  assert.match(org[0]!.name, /Valuación Profesional de Chiapas/)
  assert.equal(rows(s.documentTypes), 15, '7 requeridos + 6 opcionales + 2 de credencial')
  assert.equal(rows(s.memberStatuses), 4)
  assert.equal(rows(s.annualFees), 1)

  // — Autenticación
  assert.equal(login('admin', 'incorrecta').ok, false, 'contraseña mala debe fallar')
  const good = login('admin', 'admin')
  assert.equal(good.ok, true, 'login correcto debe entrar')
  assert.ok(me(), 'debe haber sesión activa')
  logout()
  assert.equal(me(), null, 'logout debe cerrar la sesión')

  // — Módulo de miembros: alta con número automático e historial
  const created = createMember(
    {
      title: 'Ing.',
      givenNames: 'Valente Raffet',
      paternalSurname: 'Ordoñez',
      maternalSurname: 'de la Cruz',
      phone: '9621437279'
    },
    null
  )
  assert.equal(created.memberNumber, 'M-001', 'el sistema asigna el número con el formato configurado')
  assert.equal(created.fullName, 'Ing. Valente Raffet Ordoñez de la Cruz')
  assert.equal(created.statusCode, 'activo')
  assert.equal(created.history.length, 1, 'el alta genera su primer registro de historial')

  const second = createMember({ givenNames: 'Paola', paternalSurname: 'Rincón' }, null)
  assert.equal(second.memberNumber, 'M-002', 'la secuencia avanza')

  // — Búsqueda inmediata sin acentos ni ñ, con prefijos
  assert.equal(listMembers({ search: 'ordonez' }).length, 1)
  assert.equal(listMembers({ search: 'rincon pao' }).length, 1)
  assert.equal(listMembers({}).length, 2)

  // — Edición reconstruye el nombre completo (y la FTS lo sigue)
  const updated = updateMember(created.id, { title: null, curp: 'OACV800101HCSRRL09' }, null)
  assert.equal(updated.fullName, 'Valente Raffet Ordoñez de la Cruz')
  assert.equal(listMembers({ search: 'valente' }).length, 1)

  // — Cambio de estado: historial + filtro
  const suspended = changeStatus(created.id, 'suspendido', 'Prueba de humo', null)
  assert.equal(suspended.statusCode, 'suspendido')
  assert.equal(suspended.history.length, 2)
  assert.equal(listMembers({ statusCode: 'suspendido' }).length, 1)

  // — Papelera: desaparece de listas y búsquedas, sin borrado físico
  softDeleteMember(second.id, null)
  assert.equal(listMembers({}).length, 1)
  assert.equal(listMembers({ search: 'rincon' }).length, 0)
  assert.equal(rows(s.members), 2, 'el registro sigue en la base (borrado lógico)')

  // — Auditoría por eventos (2 logins + 1 logout registrados arriba)
  const auditCount = rows(s.auditLog)
  assert.ok(auditCount >= 3, `la auditoría debe tener registros (tiene ${auditCount})`)

  // — Pagos y anualidades (docs/03 §4.4): estado calculado, nunca almacenado
  setAnnualFee({ year: 2026, amountCents: 150000 }, null) // ya existe por semilla; confirma update
  createPayment(
    { memberId: created.id, year: 2026, kind: 'pago', amountCents: 75000, paidAt: '2026-03-10', method: 'efectivo' },
    null
  )
  let annuities = annuitiesByYear(2026)
  let mine = annuities.find((a) => a.memberId === created.id)!
  assert.equal(mine.status, 'parcial', 'un abono menor a la cuota debe quedar parcial')

  createPayment(
    { memberId: created.id, year: 2026, kind: 'pago', amountCents: 75000, paidAt: '2026-04-01', method: 'efectivo' },
    null
  )
  annuities = annuitiesByYear(2026)
  mine = annuities.find((a) => a.memberId === created.id)!
  assert.equal(mine.status, 'cubierta', 'la suma de abonos debe cubrir la cuota')

  const thirdMember = createMember({ givenNames: 'Rene' }, null)
  createPayment(
    { memberId: thirdMember.id, year: 2026, kind: 'apoyo_en_especie', amountCents: 0, paidAt: '2026-02-01', method: null },
    null
  )
  const supportRow = annuitiesByYear(2026).find((a) => a.memberId === thirdMember.id)!
  assert.equal(supportRow.status, 'cubierta', 'un apoyo en especie cubre la anualidad sin dinero')
  assert.equal(supportRow.hasInKindSupport, true)

  assert.equal(rows(s.payments), 3)

  // — Expedientes (M3): progreso, vencimiento derivado, físico y credencial.
  // pickAndStoreFile() usa el diálogo nativo (requiere ventana), así que aquí se
  // simula la carga insertando file + document_version directamente, igual que
  // lo haría uploadVersion() tras elegir el archivo.
  const expedienteBefore = getMemberExpediente(created.id)
  assert.equal(expedienteBefore.requiredCompleted, 0, 'nadie ha subido nada todavía')
  const ineType = expedienteBefore.entries.find((e) => e.documentTypeName === 'INE')!
  assert.ok(ineType.hasExpiry, 'INE debe tener vencimiento configurable')

  const mdocId = uuidv7()
  db.insert(s.memberDocuments)
    .values({ id: mdocId, memberId: created.id, documentTypeId: ineType.documentTypeId, status: 'pendiente' })
    .run()
  const fileId = uuidv7()
  db.insert(s.files)
    .values({ id: fileId, sha256: 'a'.repeat(64), sizeBytes: 1024, mimeType: 'image/jpeg', originalName: 'ine.jpg' })
    .run()
  db.insert(s.documentVersions)
    .values({ id: uuidv7(), memberDocumentId: mdocId, versionNumber: 1, fileId, uploadedAt: new Date().toISOString() })
    .run()

  const withPastExpiry = setExpiry(mdocId, '2020-01-01', null)
  assert.equal(withPastExpiry.status, 'pendiente', 'el status crudo no cambia solo')
  const marked = setDocumentStatus(mdocId, 'vigente', null)
  assert.equal(marked.derivedStatus, 'vencido', 'vigente + fecha pasada se deriva como vencido, nunca almacenado')
  assert.equal(db.select().from(s.memberDocuments).where(eq(s.memberDocuments.id, mdocId)).get()!.status, 'vigente')

  const withPhysical = setPhysical(mdocId, true, 'Archivero, gaveta 2', null)
  assert.equal(withPhysical.hasPhysical, true)
  assert.equal(withPhysical.physicalLocation, 'Archivero, gaveta 2')

  const soon = new Date()
  soon.setDate(soon.getDate() + 10)
  const otherType = expedienteBefore.entries.find((e) => e.documentTypeName === 'Constancia de Situación Fiscal')!
  const otherMdocId = uuidv7()
  db.insert(s.memberDocuments)
    .values({
      id: otherMdocId,
      memberId: created.id,
      documentTypeId: otherType.documentTypeId,
      status: 'vigente',
      expiresAt: soon.toISOString().slice(0, 10)
    })
    .run()
  const expiring = upcomingExpirations(30)
  assert.ok(
    expiring.some((e) => e.memberId === created.id && e.documentTypeName === 'Constancia de Situación Fiscal'),
    'un documento vigente que vence en 10 días debe salir en el recordatorio a 30 días'
  )

  const credential = getCredential(created.id)
  assert.equal(credential.front.version, null, 'sin credencial cargada, el anverso debe venir vacío')
  assert.ok(credential.front.documentTypeId && credential.back.documentTypeId, 'los tipos de credencial deben existir por semilla')

  console.log('SMOKE OK — migraciones, semillas, auth, FTS, pagos/anualidades, expedientes y auditoría funcionan')
} finally {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
}
