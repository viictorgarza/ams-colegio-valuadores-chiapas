import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, type SQL } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
// Imports relativos a propósito: este servicio también corre fuera del bundle
// de Electron (scripts/smoke.ts con tsx), donde los alias no existen.
import { getDb, getSqlite } from '../../core/db'
import * as s from '../../core/db/schema'
import { getSetting, setSetting } from '../../core/db/settings'
import { bus } from '../../core/events/bus'
import type {
  CreateMemberInput,
  MemberDetail,
  MemberFilters,
  MemberListItem,
  UpdateMemberInput
} from '../../../shared/contracts'

export class MemberError extends Error {}

// ── Utilidades ──────────────────────────────────────────────────────────────

function buildFullName(
  title: string | null | undefined,
  givenNames: string,
  paternal: string | null | undefined,
  maternal: string | null | undefined
): string {
  return [title, givenNames, paternal, maternal].filter(Boolean).join(' ')
}

function formatMemberNumber(format: string, seq: number): string {
  return format.replace(/\{seq(?::(\d+))?\}/, (_m, width: string | undefined) =>
    String(seq).padStart(width ? Number(width) : 0, '0')
  )
}

/** Asigna el siguiente número de miembro según el formato configurado, evitando colisiones. */
function nextMemberNumber(): string {
  const db = getDb()
  const format = getSetting('member_number_format', 'M-{seq:3}')
  let seq = getSetting('next_member_seq', 1)
  for (let i = 0; i < 100000; i++, seq++) {
    const candidate = formatMemberNumber(format, seq)
    const clash = db
      .select({ id: s.members.id })
      .from(s.members)
      .where(eq(s.members.memberNumber, candidate))
      .get()
    if (!clash) {
      setSetting('next_member_seq', seq + 1)
      return candidate
    }
  }
  throw new MemberError('No se pudo asignar un número de miembro libre')
}

/** Búsqueda inmediata sobre el índice FTS5 (prefijos, sin acentos ni ñ). */
function searchMemberIds(search: string): string[] {
  const terms = search
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)
  if (terms.length === 0) return []
  const match = terms.map((t) => `"${t}"*`).join(' ')
  const rows = getSqlite()
    .prepare('SELECT member_id FROM members_fts WHERE members_fts MATCH ?')
    .all(match) as Array<{ member_id: string }>
  return rows.map((r) => r.member_id)
}

function statusByCode(code: string): { id: string; code: string; name: string } {
  const row = getDb().select().from(s.memberStatuses).where(eq(s.memberStatuses.code, code)).get()
  if (!row) throw new MemberError(`Estado de miembro desconocido: ${code}`)
  return row
}

// ── Consultas ───────────────────────────────────────────────────────────────

export function listMembers(filters: MemberFilters): MemberListItem[] {
  const db = getDb()
  const conds: SQL[] = [isNull(s.members.deletedAt)]

  if (filters.statusCode) conds.push(eq(s.memberStatuses.code, filters.statusCode))
  if (filters.isPerito) conds.push(eq(s.members.isPerito, true))
  if (filters.hasMasters) conds.push(and(isNotNull(s.members.masters), ne(s.members.masters, ''))!)
  if (filters.hasDoctorate) conds.push(and(isNotNull(s.members.doctorate), ne(s.members.doctorate, ''))!)

  if (filters.search && filters.search.length > 0) {
    const ids = searchMemberIds(filters.search)
    if (ids.length === 0) return []
    conds.push(inArray(s.members.id, ids))
  }

  return db
    .select({
      id: s.members.id,
      memberNumber: s.members.memberNumber,
      title: s.members.title,
      givenNames: s.members.givenNames,
      paternalSurname: s.members.paternalSurname,
      maternalSurname: s.members.maternalSurname,
      fullName: s.members.fullName,
      phone: s.members.phone,
      email: s.members.email,
      statusCode: s.memberStatuses.code,
      statusName: s.memberStatuses.name,
      isPerito: s.members.isPerito
    })
    .from(s.members)
    .innerJoin(s.memberStatuses, eq(s.members.statusId, s.memberStatuses.id))
    .where(and(...conds))
    .orderBy(asc(s.members.paternalSurname), asc(s.members.maternalSurname), asc(s.members.givenNames))
    .all()
}

export function getMember(id: string): MemberDetail | null {
  const db = getDb()
  const row = db
    .select({
      member: s.members,
      statusCode: s.memberStatuses.code,
      statusName: s.memberStatuses.name,
      membershipTypeName: s.membershipTypes.name
    })
    .from(s.members)
    .innerJoin(s.memberStatuses, eq(s.members.statusId, s.memberStatuses.id))
    .innerJoin(s.membershipTypes, eq(s.members.membershipTypeId, s.membershipTypes.id))
    .where(and(eq(s.members.id, id), isNull(s.members.deletedAt)))
    .get()
  if (!row) return null

  const history = db
    .select({
      statusCode: s.memberStatuses.code,
      statusName: s.memberStatuses.name,
      changedAt: s.memberStatusHistory.changedAt,
      reason: s.memberStatusHistory.reason,
      changedByName: s.users.fullName
    })
    .from(s.memberStatusHistory)
    .innerJoin(s.memberStatuses, eq(s.memberStatusHistory.statusId, s.memberStatuses.id))
    .leftJoin(s.users, eq(s.memberStatusHistory.changedBy, s.users.id))
    .where(eq(s.memberStatusHistory.memberId, id))
    .orderBy(desc(s.memberStatusHistory.changedAt))
    .all()

  const m = row.member
  return {
    id: m.id,
    memberNumber: m.memberNumber,
    title: m.title,
    givenNames: m.givenNames,
    paternalSurname: m.paternalSurname,
    maternalSurname: m.maternalSurname,
    fullName: m.fullName,
    curp: m.curp,
    rfc: m.rfc,
    email: m.email,
    phone: m.phone,
    phoneHome: m.phoneHome,
    street: m.street,
    city: m.city,
    state: m.state,
    zip: m.zip,
    university: m.university,
    degree: m.degree,
    specialty: m.specialty,
    masters: m.masters,
    doctorate: m.doctorate,
    company: m.company,
    position: m.position,
    isPerito: m.isPerito,
    peritoNumber: m.peritoNumber,
    statusCode: row.statusCode,
    statusName: row.statusName,
    membershipTypeName: row.membershipTypeName,
    joinedAt: m.joinedAt,
    observations: m.observations,
    createdAt: m.createdAt,
    history
  }
}

// ── Escrituras ──────────────────────────────────────────────────────────────

export function createMember(input: CreateMemberInput, actorId: string | null): MemberDetail {
  const db = getDb()
  const status = statusByCode('activo')
  const membershipType = db.select().from(s.membershipTypes).orderBy(asc(s.membershipTypes.sortOrder)).get()
  if (!membershipType) throw new MemberError('No hay tipos de membresía configurados')

  const id = uuidv7()
  const now = new Date().toISOString()
  db.insert(s.members)
    .values({
      id,
      memberNumber: nextMemberNumber(),
      title: input.title ?? null,
      givenNames: input.givenNames,
      paternalSurname: input.paternalSurname ?? null,
      maternalSurname: input.maternalSurname ?? null,
      fullName: buildFullName(input.title, input.givenNames, input.paternalSurname, input.maternalSurname),
      phone: input.phone ?? null,
      membershipTypeId: membershipType.id,
      statusId: status.id
    })
    .run()
  db.insert(s.memberStatusHistory)
    .values({ id: uuidv7(), memberId: id, statusId: status.id, changedAt: now, reason: 'Alta', changedBy: actorId })
    .run()

  const detail = getMember(id)
  if (!detail) throw new MemberError('El miembro no se pudo leer tras crearlo')
  bus.emit('member.created', { actorId, memberId: id, after: snapshot(detail) })
  return detail
}

export function updateMember(id: string, patch: UpdateMemberInput, actorId: string | null): MemberDetail {
  const db = getDb()
  const before = getMember(id)
  if (!before) throw new MemberError('El miembro no existe o está en la papelera')

  const merged = { ...before, ...patch }
  db.update(s.members)
    .set({
      ...patch,
      fullName: buildFullName(merged.title, merged.givenNames, merged.paternalSurname, merged.maternalSurname),
      updatedAt: new Date().toISOString()
    })
    .where(eq(s.members.id, id))
    .run()

  const after = getMember(id)
  if (!after) throw new MemberError('El miembro no se pudo leer tras actualizarlo')
  bus.emit('member.updated', { actorId, memberId: id, before: snapshot(before), after: snapshot(after) })
  return after
}

export function changeStatus(
  id: string,
  statusCode: string,
  reason: string | null,
  actorId: string | null
): MemberDetail {
  const db = getDb()
  const before = getMember(id)
  if (!before) throw new MemberError('El miembro no existe o está en la papelera')
  if (before.statusCode === statusCode) return before

  const status = statusByCode(statusCode)
  const now = new Date().toISOString()
  db.update(s.members).set({ statusId: status.id, updatedAt: now }).where(eq(s.members.id, id)).run()
  db.insert(s.memberStatusHistory)
    .values({ id: uuidv7(), memberId: id, statusId: status.id, changedAt: now, reason, changedBy: actorId })
    .run()

  const after = getMember(id)
  if (!after) throw new MemberError('El miembro no se pudo leer tras el cambio de estado')
  bus.emit('member.status_changed', {
    actorId,
    memberId: id,
    fromCode: before.statusCode,
    toCode: statusCode,
    reason
  })
  return after
}

/** Papelera: borrado lógico. La FTS deja de encontrarlo vía listMembers (filtra deleted_at). */
export function softDeleteMember(id: string, actorId: string | null): void {
  const before = getMember(id)
  if (!before) throw new MemberError('El miembro no existe o ya está en la papelera')
  getDb()
    .update(s.members)
    .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(s.members.id, id))
    .run()
  bus.emit('member.deleted', { actorId, memberId: id, before: snapshot(before) })
}

/** Versión compacta para la auditoría (sin el historial). */
function snapshot(d: MemberDetail): Record<string, unknown> {
  const { history: _history, ...rest } = d
  return rest
}
