import { and, asc, desc, eq, isNotNull, isNull, lte } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { app, BrowserWindow, dialog } from 'electron'
import { copyFileSync, mkdirSync } from 'node:fs'
import { extname, join } from 'node:path'
// Imports relativos a propósito, como en payments.service.ts: este módulo también
// se ejecuta fuera del bundle de Electron (scripts/smoke.ts con tsx), donde los alias no existen.
import { getDb } from '../../core/db'
import * as s from '../../core/db/schema'
import { getSetting, setSetting } from '../../core/db/settings'
import { bus } from '../../core/events/bus'
import {
  CREDENTIAL_BACK_NAME,
  CREDENTIAL_FRONT_NAME,
  type CreateDocumentTypeInput,
  type DocumentType,
  type DocumentVersion,
  type ExpedienteOverviewItem,
  type MemberDocumentEntry,
  type MemberExpediente,
  type UpcomingExpiration,
  type UpdateDocumentTypeInput
} from '../../../shared/contracts'
import {
  mimeTypeFor,
  openStoredFile,
  pickAndStoreFile,
  readStoredFileBase64,
  saveStoredFileAs,
  storeFileFromPath,
  storedFilePath
} from './documents.files'

export class DocumentError extends Error {}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function toVersion(row: typeof s.documentVersions.$inferSelect, file: typeof s.files.$inferSelect): DocumentVersion {
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    originalName: file.originalName,
    mimeType: file.mimeType,
    uploadedAt: row.uploadedAt,
    observations: row.observations
  }
}

function derive(
  status: 'pendiente' | 'vigente' | 'rechazado',
  expiresAt: string | null
): 'pendiente' | 'vigente' | 'rechazado' | 'vencido' {
  if (status === 'vigente' && expiresAt && expiresAt < today()) return 'vencido'
  return status
}

export function getMemberExpediente(memberId: string): MemberExpediente {
  const db = getDb()
  const types = db
    .select()
    .from(s.documentTypes)
    .where(eq(s.documentTypes.isActive, true))
    .orderBy(asc(s.documentTypes.sortOrder))
    .all()
  const mdocs = db
    .select()
    .from(s.memberDocuments)
    .where(and(eq(s.memberDocuments.memberId, memberId), isNull(s.memberDocuments.deletedAt)))
    .all()
  const byType = new Map(mdocs.map((d) => [d.documentTypeId, d]))

  const entries: MemberDocumentEntry[] = types.map((t) => {
    const mdoc = byType.get(t.id)
    const versions = mdoc
      ? db
          .select({ v: s.documentVersions, f: s.files })
          .from(s.documentVersions)
          .innerJoin(s.files, eq(s.documentVersions.fileId, s.files.id))
          .where(eq(s.documentVersions.memberDocumentId, mdoc.id))
          .orderBy(desc(s.documentVersions.versionNumber))
          .all()
          .map((r) => toVersion(r.v, r.f))
      : []
    return {
      documentTypeId: t.id,
      documentTypeName: t.name,
      isRequired: t.isRequired,
      hasExpiry: t.hasExpiry,
      allowsMultiple: t.allowsMultiple,
      memberDocumentId: mdoc?.id ?? null,
      status: mdoc?.status ?? 'pendiente',
      derivedStatus: derive(mdoc?.status ?? 'pendiente', mdoc?.expiresAt ?? null),
      validityMonths: t.validityMonths,
      issuedAt: mdoc?.issuedAt ?? null,
      expiresAt: mdoc?.expiresAt ?? null,
      hasPhysical: mdoc?.hasPhysical ?? false,
      physicalLocation: mdoc?.physicalLocation ?? null,
      notes: mdoc?.notes ?? null,
      versions
    }
  })

  const required = entries.filter((e) => e.isRequired)
  return {
    entries,
    requiredTotal: required.length,
    requiredCompleted: required.filter((e) => e.derivedStatus === 'vigente').length
  }
}

function entryFor(memberId: string, documentTypeId: string): MemberDocumentEntry {
  const entry = getMemberExpediente(memberId).entries.find((e) => e.documentTypeId === documentTypeId)
  if (!entry) throw new DocumentError('Tipo de documento no encontrado')
  return entry
}

function memberDocumentRow(memberDocumentId: string): typeof s.memberDocuments.$inferSelect {
  const row = getDb().select().from(s.memberDocuments).where(eq(s.memberDocuments.id, memberDocumentId)).get()
  if (!row) throw new DocumentError('Expediente no encontrado')
  return row
}

function getOrCreateMemberDocument(memberId: string, documentTypeId: string): typeof s.memberDocuments.$inferSelect {
  const db = getDb()
  const existing = db
    .select()
    .from(s.memberDocuments)
    .where(
      and(
        eq(s.memberDocuments.memberId, memberId),
        eq(s.memberDocuments.documentTypeId, documentTypeId),
        isNull(s.memberDocuments.deletedAt)
      )
    )
    .get()
  if (existing) return existing
  const id = uuidv7()
  db.insert(s.memberDocuments).values({ id, memberId, documentTypeId, status: 'pendiente' }).run()
  return db.select().from(s.memberDocuments).where(eq(s.memberDocuments.id, id)).get()!
}

function assertUploadTargets(
  memberId: string,
  documentTypeId: string
): { member: typeof s.members.$inferSelect; docType: typeof s.documentTypes.$inferSelect } {
  const db = getDb()
  const member = db.select().from(s.members).where(eq(s.members.id, memberId)).get()
  if (!member || member.deletedAt) throw new DocumentError('El miembro no existe o está en la papelera')
  const docType = db.select().from(s.documentTypes).where(eq(s.documentTypes.id, documentTypeId)).get()
  if (!docType) throw new DocumentError('Tipo de documento no encontrado')
  return { member, docType }
}

/** Inserta metadata de archivo (deduplicada por hash) + nueva versión, y marca vigente. */
function finalizeUpload(
  memberId: string,
  documentTypeId: string,
  docTypeName: string,
  picked: { sha256: string; sizeBytes: number; originalName: string },
  actorId: string | null
): MemberDocumentEntry {
  const db = getDb()
  let file = db.select().from(s.files).where(eq(s.files.sha256, picked.sha256)).get()
  if (!file) {
    const fileId = uuidv7()
    db.insert(s.files)
      .values({
        id: fileId,
        sha256: picked.sha256,
        sizeBytes: picked.sizeBytes,
        mimeType: mimeTypeFor(picked.originalName),
        originalName: picked.originalName,
        createdBy: actorId
      })
      .run()
    file = db.select().from(s.files).where(eq(s.files.id, fileId)).get()!
  }

  const mdoc = getOrCreateMemberDocument(memberId, documentTypeId)
  const nextVersion =
    db
      .select({ v: s.documentVersions.versionNumber })
      .from(s.documentVersions)
      .where(eq(s.documentVersions.memberDocumentId, mdoc.id))
      .all()
      .reduce((max, r) => Math.max(max, r.v), 0) + 1

  db.insert(s.documentVersions)
    .values({
      id: uuidv7(),
      memberDocumentId: mdoc.id,
      versionNumber: nextVersion,
      fileId: file.id,
      uploadedBy: actorId,
      uploadedAt: new Date().toISOString()
    })
    .run()

  db.update(s.memberDocuments)
    .set({ status: 'vigente', updatedAt: new Date().toISOString() })
    .where(eq(s.memberDocuments.id, mdoc.id))
    .run()

  bus.emit('document.uploaded', {
    actorId,
    memberId,
    memberDocumentId: mdoc.id,
    documentTypeName: docTypeName
  })
  return entryFor(memberId, documentTypeId)
}

/** Subida por diálogo nativo (botón "Subir"/"Reemplazar"). null si se canceló el diálogo. */
export async function uploadVersion(
  memberId: string,
  documentTypeId: string,
  actorId: string | null
): Promise<MemberDocumentEntry | null> {
  const { docType } = assertUploadTargets(memberId, documentTypeId)
  const picked = await pickAndStoreFile()
  if (!picked) return null
  return finalizeUpload(memberId, documentTypeId, docType.name, picked, actorId)
}

/** Subida por arrastrar y soltar (docs/04 §3): la ruta viene de webUtils.getPathForFile. */
export function uploadVersionFromPath(
  memberId: string,
  documentTypeId: string,
  filePath: string,
  actorId: string | null
): MemberDocumentEntry {
  const { docType } = assertUploadTargets(memberId, documentTypeId)
  const picked = storeFileFromPath(filePath)
  return finalizeUpload(memberId, documentTypeId, docType.name, picked, actorId)
}

export function setStatus(
  memberDocumentId: string,
  status: 'pendiente' | 'vigente' | 'rechazado',
  actorId: string | null
): MemberDocumentEntry {
  const row = memberDocumentRow(memberDocumentId)
  getDb()
    .update(s.memberDocuments)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(s.memberDocuments.id, memberDocumentId))
    .run()
  bus.emit('document.status_changed', {
    actorId,
    memberId: row.memberId,
    memberDocumentId,
    fromStatus: row.status,
    toStatus: status
  })
  return entryFor(row.memberId, row.documentTypeId)
}

/** Suma meses a una fecha "YYYY-MM-DD" sin pasar por Date/UTC (mismo cuidado que en eventos). */
function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number]
  const date = new Date(y, m - 1 + months, d)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Fecha de emisión de un documento: si el tipo tiene vigencia configurada
 * (validityMonths), calcula "vigente hasta" sola; si no, no toca expiresAt
 * (se sigue capturando a mano con setExpiry). */
export function setIssuedAt(
  memberDocumentId: string,
  issuedAt: string | null,
  actorId: string | null
): MemberDocumentEntry {
  const row = memberDocumentRow(memberDocumentId)
  const docType = getDb().select().from(s.documentTypes).where(eq(s.documentTypes.id, row.documentTypeId)).get()
  const autoExpiresAt = issuedAt && docType?.validityMonths ? addMonths(issuedAt, docType.validityMonths) : undefined

  getDb()
    .update(s.memberDocuments)
    .set({
      issuedAt,
      ...(autoExpiresAt !== undefined ? { expiresAt: autoExpiresAt } : {}),
      updatedAt: new Date().toISOString()
    })
    .where(eq(s.memberDocuments.id, memberDocumentId))
    .run()
  bus.emit('document.issued_at_changed', {
    actorId,
    memberId: row.memberId,
    memberDocumentId,
    fromIssuedAt: row.issuedAt,
    toIssuedAt: issuedAt,
    autoExpiresAt: autoExpiresAt ?? null
  })
  return entryFor(row.memberId, row.documentTypeId)
}

export function setExpiry(memberDocumentId: string, expiresAt: string | null, actorId: string | null): MemberDocumentEntry {
  const row = memberDocumentRow(memberDocumentId)
  getDb()
    .update(s.memberDocuments)
    .set({ expiresAt, updatedAt: new Date().toISOString() })
    .where(eq(s.memberDocuments.id, memberDocumentId))
    .run()
  bus.emit('document.expiry_changed', {
    actorId,
    memberId: row.memberId,
    memberDocumentId,
    fromExpiresAt: row.expiresAt,
    toExpiresAt: expiresAt
  })
  return entryFor(row.memberId, row.documentTypeId)
}

export function setNotes(memberDocumentId: string, notes: string | null, actorId: string | null): MemberDocumentEntry {
  const row = memberDocumentRow(memberDocumentId)
  getDb()
    .update(s.memberDocuments)
    .set({ notes, updatedAt: new Date().toISOString() })
    .where(eq(s.memberDocuments.id, memberDocumentId))
    .run()
  bus.emit('document.notes_changed', { actorId, memberId: row.memberId, memberDocumentId })
  return entryFor(row.memberId, row.documentTypeId)
}

export function setPhysical(
  memberDocumentId: string,
  hasPhysical: boolean,
  physicalLocation: string | null,
  actorId: string | null
): MemberDocumentEntry {
  const row = memberDocumentRow(memberDocumentId)
  getDb()
    .update(s.memberDocuments)
    .set({ hasPhysical, physicalLocation, updatedAt: new Date().toISOString() })
    .where(eq(s.memberDocuments.id, memberDocumentId))
    .run()
  bus.emit('document.physical_changed', { actorId, memberId: row.memberId, memberDocumentId, hasPhysical })
  return entryFor(row.memberId, row.documentTypeId)
}

/** Borra (papelera lógica) el documento cargado de un tipo, para corregir errores
 * de captura — vuelve a "pendiente" y se puede subir de nuevo desde cero. */
export function removeMemberDocument(memberDocumentId: string, actorId: string | null): MemberDocumentEntry {
  const row = memberDocumentRow(memberDocumentId)
  getDb()
    .update(s.memberDocuments)
    .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(s.memberDocuments.id, memberDocumentId))
    .run()
  bus.emit('document.deleted', {
    actorId,
    memberId: row.memberId,
    memberDocumentId,
    documentTypeName: getDb().select().from(s.documentTypes).where(eq(s.documentTypes.id, row.documentTypeId)).get()!
      .name
  })
  return entryFor(row.memberId, row.documentTypeId)
}

export function listDeletedMemberDocuments(): Array<{
  id: string
  label: string
  detail: string | null
  deletedAt: string
}> {
  const db = getDb()
  const rows = db.select().from(s.memberDocuments).where(isNotNull(s.memberDocuments.deletedAt)).all()
  return rows.map((d) => {
    const member = db.select({ fullName: s.members.fullName }).from(s.members).where(eq(s.members.id, d.memberId)).get()
    const docType = db
      .select({ name: s.documentTypes.name })
      .from(s.documentTypes)
      .where(eq(s.documentTypes.id, d.documentTypeId))
      .get()
    return {
      id: d.id,
      label: `${docType?.name ?? 'Documento'} — ${member?.fullName ?? 'Miembro'}`,
      detail: null,
      deletedAt: d.deletedAt!
    }
  })
}

export function restoreMemberDocument(memberDocumentId: string, actorId: string | null): void {
  const db = getDb()
  const row = db
    .select()
    .from(s.memberDocuments)
    .where(and(eq(s.memberDocuments.id, memberDocumentId), isNotNull(s.memberDocuments.deletedAt)))
    .get()
  if (!row) throw new DocumentError('El documento no está en la papelera')
  db.update(s.memberDocuments)
    .set({ deletedAt: null, updatedAt: new Date().toISOString() })
    .where(eq(s.memberDocuments.id, memberDocumentId))
    .run()
  bus.emit('document.restored', { actorId, memberId: row.memberId, memberDocumentId })
}

function versionFile(versionId: string): { path: string; originalName: string; mimeType: string } {
  const row = getDb()
    .select({ f: s.files })
    .from(s.documentVersions)
    .innerJoin(s.files, eq(s.documentVersions.fileId, s.files.id))
    .where(eq(s.documentVersions.id, versionId))
    .get()
  if (!row) throw new DocumentError('Versión no encontrada')
  return {
    path: storedFilePath(row.f.sha256, row.f.originalName),
    originalName: row.f.originalName,
    mimeType: row.f.mimeType
  }
}

export async function openVersion(versionId: string): Promise<void> {
  await openStoredFile(versionFile(versionId).path)
}

export async function downloadVersion(versionId: string): Promise<string | null> {
  const { path, originalName } = versionFile(versionId)
  return saveStoredFileAs(path, originalName)
}

export function getVersionData(versionId: string): { mimeType: string; dataBase64: string; originalName: string } {
  const { path, originalName, mimeType } = versionFile(versionId)
  return { mimeType, originalName, dataBase64: readStoredFileBase64(path) }
}

// ── Detección de vigencia por IA (Google Cloud Vision, docs/05 v2) ─────────
// Autorizado por Victor 2026-07-12 (aviso de privacidad ya cubre el envío de
// documentos a terceros). Best-effort: solo funciona con internet, igual que
// la búsqueda de CP; si falla, se captura la fecha a mano como siempre.

const OCR_API_KEY_SETTING = 'google_vision_api_key'

export function isOcrConfigured(): boolean {
  return !!getSetting<string | null>(OCR_API_KEY_SETTING, null)
}

export function setOcrApiKey(apiKey: string | null, actorId: string | null): void {
  setSetting(OCR_API_KEY_SETTING, apiKey)
  bus.emit('ocr.api_key_changed', { actorId, configured: !!apiKey })
}

const MONTHS_ES: Record<string, string> = {
  enero: '01',
  febrero: '02',
  marzo: '03',
  abril: '04',
  mayo: '05',
  junio: '06',
  julio: '07',
  agosto: '08',
  septiembre: '09',
  octubre: '10',
  noviembre: '11',
  diciembre: '12'
}

/**
 * Heurística de extracción de fecha de vigencia sobre texto OCR crudo.
 * No hay comprensión semántica real (Vision solo hace OCR) — busca fechas
 * cerca de palabras clave y, si no encuentra, un rango de años tipo INE
 * ("VIGENCIA 2019 2029"). Siempre debe presentarse como sugerencia a
 * confirmar por la usuaria, nunca guardarse directo sin revisión.
 */
export function extractDateFromText(text: string): string | null {
  const upper = text.toUpperCase()
  const keywordIdx = ['VIGENCIA', 'VENCE', 'VENCIMIENTO', 'EXPIRA', 'CADUCA']
    .map((k) => upper.indexOf(k))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)[0]

  const window = keywordIdx !== undefined ? text.slice(keywordIdx, keywordIdx + 60) : text

  const iso = window.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const slash = window.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/)
  if (slash) return `${slash[3]!}-${slash[2]!.padStart(2, '0')}-${slash[1]!.padStart(2, '0')}`

  const withMonthName = window.match(
    /\b(\d{1,2})\s+DE\s+([A-ZÁÉÍÓÚ]+)\s+DE\s+(\d{4})\b/i
  )
  if (withMonthName) {
    const month = MONTHS_ES[withMonthName[2]!.toLowerCase()]
    if (month) return `${withMonthName[3]!}-${month}-${withMonthName[1]!.padStart(2, '0')}`
  }

  // Vigencia tipo INE: dos años seguidos ("2019 2029") — se toma el mayor,
  // aproximado al 31 de diciembre (siempre a confirmar por la usuaria).
  const yearPair = window.match(/\b(20\d{2})\D{1,5}(20\d{2})\b/)
  if (yearPair) {
    const later = Math.max(Number(yearPair[1]), Number(yearPair[2]))
    return `${later}-12-31`
  }

  return null
}

export async function detectExpiry(
  versionId: string
): Promise<{ ok: boolean; candidateDate: string | null; rawTextPreview: string | null; error: string | null }> {
  const apiKey = getSetting<string | null>(OCR_API_KEY_SETTING, null)
  if (!apiKey) {
    return { ok: false, candidateDate: null, rawTextPreview: null, error: 'No hay una API key de Google Cloud Vision configurada (Configuración → OCR).' }
  }

  const { path, mimeType } = versionFile(versionId)
  if (!mimeType.startsWith('image/')) {
    return { ok: false, candidateDate: null, rawTextPreview: null, error: 'Solo funciona con fotos (JPG/PNG/HEIC), no con PDF.' }
  }

  try {
    const base64 = readStoredFileBase64(path)
    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{ image: { content: base64 }, features: [{ type: 'TEXT_DETECTION' }] }]
      })
    })
    const json = (await response.json()) as {
      responses?: Array<{ fullTextAnnotation?: { text: string }; error?: { message: string } }>
      error?: { message: string }
    }
    const apiError = json.error?.message ?? json.responses?.[0]?.error?.message
    if (apiError) return { ok: false, candidateDate: null, rawTextPreview: null, error: apiError }

    const text = json.responses?.[0]?.fullTextAnnotation?.text ?? null
    if (!text) return { ok: true, candidateDate: null, rawTextPreview: null, error: null }

    return { ok: true, candidateDate: extractDateFromText(text), rawTextPreview: text.slice(0, 300), error: null }
  } catch {
    return {
      ok: false,
      candidateDate: null,
      rawTextPreview: null,
      error: 'No se pudo conectar a internet para detectar la fecha.'
    }
  }
}

export function getCredential(memberId: string): {
  front: { documentTypeId: string; version: DocumentVersion | null }
  back: { documentTypeId: string; version: DocumentVersion | null }
} {
  const db = getDb()
  const frontType = db.select().from(s.documentTypes).where(eq(s.documentTypes.name, CREDENTIAL_FRONT_NAME)).get()
  const backType = db.select().from(s.documentTypes).where(eq(s.documentTypes.name, CREDENTIAL_BACK_NAME)).get()
  if (!frontType || !backType) throw new DocumentError('Tipos de credencial no configurados')

  const exp = getMemberExpediente(memberId)
  const front = exp.entries.find((e) => e.documentTypeId === frontType.id)?.versions[0] ?? null
  const back = exp.entries.find((e) => e.documentTypeId === backType.id)?.versions[0] ?? null
  return {
    front: { documentTypeId: frontType.id, version: front },
    back: { documentTypeId: backType.id, version: back }
  }
}

/** Resumen de expediente por miembro (módulo Documentos): cuántos documentos
 * requeridos tiene completos y cuántos documentos ha subido en total. */
export function listExpedienteOverview(): ExpedienteOverviewItem[] {
  const db = getDb()
  const members = db
    .select({
      id: s.members.id,
      memberNumber: s.members.memberNumber,
      title: s.members.title,
      fullName: s.members.fullName,
      givenNames: s.members.givenNames,
      paternalSurname: s.members.paternalSurname,
      maternalSurname: s.members.maternalSurname
    })
    .from(s.members)
    .where(isNull(s.members.deletedAt))
    .orderBy(asc(s.members.fullName))
    .all()

  const requiredTypeIds = new Set(
    db
      .select({ id: s.documentTypes.id })
      .from(s.documentTypes)
      .where(and(eq(s.documentTypes.isRequired, true), eq(s.documentTypes.isActive, true)))
      .all()
      .map((t) => t.id)
  )

  const mdocs = db
    .select({
      memberId: s.memberDocuments.memberId,
      documentTypeId: s.memberDocuments.documentTypeId,
      status: s.memberDocuments.status,
      expiresAt: s.memberDocuments.expiresAt
    })
    .from(s.memberDocuments)
    .where(isNull(s.memberDocuments.deletedAt))
    .all()

  const byMember = new Map<string, typeof mdocs>()
  for (const d of mdocs) {
    const list = byMember.get(d.memberId) ?? []
    list.push(d)
    byMember.set(d.memberId, list)
  }

  return members.map((m) => {
    const docs = byMember.get(m.id) ?? []
    const requiredCompleted = docs.filter(
      (d) => requiredTypeIds.has(d.documentTypeId) && derive(d.status, d.expiresAt) === 'vigente'
    ).length
    return {
      memberId: m.id,
      memberNumber: m.memberNumber,
      title: m.title,
      fullName: m.fullName,
      fullNameNoTitle: [m.givenNames, m.paternalSurname, m.maternalSurname].filter(Boolean).join(' '),
      givenNames: m.givenNames,
      apellidos: [m.paternalSurname, m.maternalSurname].filter(Boolean).join(' ') || null,
      requiredTotal: requiredTypeIds.size,
      requiredCompleted,
      uploadedTotal: docs.length
    }
  })
}

export function upcomingExpirations(withinDays: number): UpcomingExpiration[] {
  const limitDate = new Date()
  limitDate.setDate(limitDate.getDate() + withinDays)
  const limitStr = limitDate.toISOString().slice(0, 10)

  const rows = getDb()
    .select({
      memberId: s.members.id,
      memberFullName: s.members.fullName,
      memberNumber: s.members.memberNumber,
      documentTypeName: s.documentTypes.name,
      expiresAt: s.memberDocuments.expiresAt
    })
    .from(s.memberDocuments)
    .innerJoin(s.documentTypes, eq(s.memberDocuments.documentTypeId, s.documentTypes.id))
    .innerJoin(s.members, eq(s.memberDocuments.memberId, s.members.id))
    .where(
      and(
        isNull(s.memberDocuments.deletedAt),
        isNull(s.members.deletedAt),
        eq(s.memberDocuments.status, 'vigente'),
        lte(s.memberDocuments.expiresAt, limitStr)
      )
    )
    .all()

  return rows
    .filter((r): r is typeof r & { expiresAt: string } => r.expiresAt !== null)
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
}

// ── Catálogo de tipos de documento (E-09, Configuración) ────────────────────

function toDocumentType(row: typeof s.documentTypes.$inferSelect): DocumentType {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isRequired: row.isRequired,
    hasExpiry: row.hasExpiry,
    validityMonths: row.validityMonths,
    allowsMultiple: row.allowsMultiple,
    sortOrder: row.sortOrder,
    isActive: row.isActive
  }
}

export function listDocumentTypes(): DocumentType[] {
  return getDb()
    .select()
    .from(s.documentTypes)
    .orderBy(asc(s.documentTypes.sortOrder))
    .all()
    .map(toDocumentType)
}

export function createDocumentType(input: CreateDocumentTypeInput, actorId: string | null): DocumentType {
  const db = getDb()
  const maxOrder = db
    .select({ sortOrder: s.documentTypes.sortOrder })
    .from(s.documentTypes)
    .all()
    .reduce((max, r) => Math.max(max, r.sortOrder), 0)

  const id = uuidv7()
  db.insert(s.documentTypes)
    .values({
      id,
      name: input.name,
      description: input.description ?? null,
      isRequired: input.isRequired,
      hasExpiry: input.hasExpiry,
      validityMonths: input.validityMonths ?? null,
      allowsMultiple: input.allowsMultiple,
      sortOrder: maxOrder + 1
    })
    .run()

  bus.emit('document_type.created', { actorId, documentTypeId: id, name: input.name })
  return toDocumentType(db.select().from(s.documentTypes).where(eq(s.documentTypes.id, id)).get()!)
}

export function updateDocumentType(
  id: string,
  patch: UpdateDocumentTypeInput,
  actorId: string | null
): DocumentType {
  const db = getDb()
  const existing = db.select().from(s.documentTypes).where(eq(s.documentTypes.id, id)).get()
  if (!existing) throw new DocumentError('Tipo de documento no encontrado')

  db.update(s.documentTypes)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(s.documentTypes.id, id))
    .run()

  bus.emit('document_type.updated', { actorId, documentTypeId: id, name: existing.name })
  return toDocumentType(db.select().from(s.documentTypes).where(eq(s.documentTypes.id, id)).get()!)
}

export function setDocumentTypeActive(id: string, isActive: boolean, actorId: string | null): DocumentType {
  const db = getDb()
  const existing = db.select().from(s.documentTypes).where(eq(s.documentTypes.id, id)).get()
  if (!existing) throw new DocumentError('Tipo de documento no encontrado')

  db.update(s.documentTypes)
    .set({ isActive, updatedAt: new Date().toISOString() })
    .where(eq(s.documentTypes.id, id))
    .run()

  bus.emit('document_type.active_changed', { actorId, documentTypeId: id, name: existing.name, isActive })
  return toDocumentType(db.select().from(s.documentTypes).where(eq(s.documentTypes.id, id)).get()!)
}

// ── Exportación masiva de expedientes (módulo Documentos) ──────────────────

/** Nombres de archivo/carpeta válidos en Windows (v1 es solo Windows) y macOS. */
function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '-').trim()
}

export interface ExportExpedientesResult {
  saved: boolean
  path: string | null
  memberCount: number
}

/**
 * Exporta el expediente de cada miembro activo a una carpeta elegida por la
 * usuaria: una subcarpeta por miembro (incluso sin documentos) con la última
 * versión de cada documento cargado, nombrada por tipo de documento.
 */
export async function exportAllExpedientes(actorId: string | null): Promise<ExportExpedientesResult> {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const pick = await dialog.showOpenDialog(win!, {
    title: 'Elegir carpeta destino para exportar expedientes',
    defaultPath: app.getPath('documents'),
    properties: ['openDirectory', 'createDirectory']
  })
  if (pick.canceled || pick.filePaths.length === 0) return { saved: false, path: null, memberCount: 0 }

  const destRoot = join(pick.filePaths[0]!, `Expedientes_${new Date().toISOString().slice(0, 10)}`)
  mkdirSync(destRoot, { recursive: true })

  const db = getDb()
  const members = db
    .select({ id: s.members.id, memberNumber: s.members.memberNumber, fullName: s.members.fullName })
    .from(s.members)
    .where(isNull(s.members.deletedAt))
    .orderBy(asc(s.members.fullName))
    .all()

  const versionRows = db
    .select({
      memberId: s.memberDocuments.memberId,
      documentTypeName: s.documentTypes.name,
      versionNumber: s.documentVersions.versionNumber,
      sha256: s.files.sha256,
      originalName: s.files.originalName
    })
    .from(s.memberDocuments)
    .innerJoin(s.documentTypes, eq(s.memberDocuments.documentTypeId, s.documentTypes.id))
    .innerJoin(s.documentVersions, eq(s.documentVersions.memberDocumentId, s.memberDocuments.id))
    .innerJoin(s.files, eq(s.documentVersions.fileId, s.files.id))
    .where(isNull(s.memberDocuments.deletedAt))
    .all()

  // Nos quedamos con la versión más reciente por (miembro, tipo de documento).
  const latestByKey = new Map<string, (typeof versionRows)[number]>()
  for (const row of versionRows) {
    const key = `${row.memberId}::${row.documentTypeName}`
    const existing = latestByKey.get(key)
    if (!existing || row.versionNumber > existing.versionNumber) latestByKey.set(key, row)
  }
  const byMember = new Map<string, Array<(typeof versionRows)[number]>>()
  for (const row of latestByKey.values()) {
    const list = byMember.get(row.memberId) ?? []
    list.push(row)
    byMember.set(row.memberId, list)
  }

  for (const m of members) {
    const memberDir = join(destRoot, sanitizeFileName(`${m.memberNumber} - ${m.fullName}`))
    mkdirSync(memberDir, { recursive: true })
    for (const doc of byMember.get(m.id) ?? []) {
      const ext = extname(doc.originalName)
      const destFile = join(memberDir, `${sanitizeFileName(doc.documentTypeName)}${ext}`)
      copyFileSync(storedFilePath(doc.sha256, doc.originalName), destFile)
    }
  }

  bus.emit('expedientes.exported', { actorId, memberCount: members.length, path: destRoot })
  return { saved: true, path: destRoot, memberCount: members.length }
}
