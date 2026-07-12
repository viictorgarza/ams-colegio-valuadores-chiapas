import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { getDb } from '../../core/db'
import * as s from '../../core/db/schema'
import { bus } from '../../core/events/bus'
import type { Assembly, AttendanceRow, CreateAssemblyInput } from '../../../shared/contracts'

export class AssemblyError extends Error {}

function toAssembly(row: typeof s.assemblies.$inferSelect, presentCount: number): Assembly {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    notes: row.notes,
    createdAt: row.createdAt,
    presentCount
  }
}

function countPresent(assemblyId: string): number {
  return getDb()
    .select({ id: s.attendanceRecords.id })
    .from(s.attendanceRecords)
    .where(and(eq(s.attendanceRecords.assemblyId, assemblyId), eq(s.attendanceRecords.present, true)))
    .all().length
}

export function listAssemblies(): Assembly[] {
  const rows = getDb()
    .select()
    .from(s.assemblies)
    .where(isNull(s.assemblies.deletedAt))
    .orderBy(desc(s.assemblies.date))
    .all()
  return rows.map((r) => toAssembly(r, countPresent(r.id)))
}

export function createAssembly(input: CreateAssemblyInput, actorId: string | null): Assembly {
  const db = getDb()
  const id = uuidv7()
  db.insert(s.assemblies)
    .values({
      id,
      date: input.date,
      title: input.title ?? null,
      notes: input.notes ?? null,
      createdBy: actorId
    })
    .run()

  const row = db.select().from(s.assemblies).where(eq(s.assemblies.id, id)).get()
  if (!row) throw new AssemblyError('La asamblea no se pudo leer tras crearla')
  bus.emit('assembly.created', { actorId, assemblyId: id, date: row.date })
  return toAssembly(row, 0)
}

export function removeAssembly(id: string, actorId: string | null): void {
  const db = getDb()
  const row = db.select().from(s.assemblies).where(and(eq(s.assemblies.id, id), isNull(s.assemblies.deletedAt))).get()
  if (!row) throw new AssemblyError('La asamblea no existe o ya está en la papelera')
  db.update(s.assemblies)
    .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(s.assemblies.id, id))
    .run()
  bus.emit('assembly.deleted', { actorId, assemblyId: id, date: row.date })
}

function memberDisplay(m: {
  id: string
  memberNumber: string
  title: string | null
  givenNames: string
  paternalSurname: string | null
  maternalSurname: string | null
}): { memberId: string; memberNumber: string; title: string | null; apellidos: string | null; givenNames: string } {
  return {
    memberId: m.id,
    memberNumber: m.memberNumber,
    title: m.title,
    apellidos: [m.paternalSurname, m.maternalSurname].filter(Boolean).join(' ') || null,
    givenNames: m.givenNames
  }
}

export function getAssembly(assemblyId: string): Assembly {
  const row = getDb().select().from(s.assemblies).where(eq(s.assemblies.id, assemblyId)).get()
  if (!row) throw new AssemblyError('La asamblea no existe')
  return toAssembly(row, countPresent(assemblyId))
}

export function getAttendance(assemblyId: string): { assembly: Assembly; rows: AttendanceRow[] } {
  const db = getDb()
  const assembly = getAssembly(assemblyId)

  const activeMembers = db
    .select({
      id: s.members.id,
      memberNumber: s.members.memberNumber,
      title: s.members.title,
      givenNames: s.members.givenNames,
      paternalSurname: s.members.paternalSurname,
      maternalSurname: s.members.maternalSurname
    })
    .from(s.members)
    .where(isNull(s.members.deletedAt))
    .orderBy(asc(s.members.memberNumber))
    .all()

  const attendance = db
    .select({ memberId: s.attendanceRecords.memberId, present: s.attendanceRecords.present })
    .from(s.attendanceRecords)
    .where(eq(s.attendanceRecords.assemblyId, assemblyId))
    .all()
  const presentByMember = new Map(attendance.map((a) => [a.memberId, a.present]))

  const rows: AttendanceRow[] = activeMembers.map((m) => ({
    ...memberDisplay(m),
    present: presentByMember.get(m.id) ?? false
  }))

  return { assembly, rows }
}

export function getAttendanceForPrint(assemblyId: string): {
  assembly: Assembly
  rows: Array<{
    memberNumber: string
    title: string | null
    apellidos: string | null
    givenNames: string
    phone: string | null
    email: string | null
    present: boolean
  }>
} {
  const db = getDb()
  const assembly = getAssembly(assemblyId)

  const activeMembers = db
    .select({
      id: s.members.id,
      memberNumber: s.members.memberNumber,
      title: s.members.title,
      givenNames: s.members.givenNames,
      paternalSurname: s.members.paternalSurname,
      maternalSurname: s.members.maternalSurname,
      phone: s.members.phone,
      email: s.members.email
    })
    .from(s.members)
    .where(isNull(s.members.deletedAt))
    .orderBy(asc(s.members.memberNumber))
    .all()

  const attendance = db
    .select({ memberId: s.attendanceRecords.memberId, present: s.attendanceRecords.present })
    .from(s.attendanceRecords)
    .where(eq(s.attendanceRecords.assemblyId, assemblyId))
    .all()
  const presentByMember = new Map(attendance.map((a) => [a.memberId, a.present]))

  const rows = activeMembers.map((m) => {
    const { memberNumber, title, apellidos, givenNames } = memberDisplay(m)
    return {
      memberNumber,
      title,
      apellidos,
      givenNames,
      phone: m.phone,
      email: m.email,
      present: presentByMember.get(m.id) ?? false
    }
  })

  return { assembly, rows }
}

export function setAttendance(
  assemblyId: string,
  memberId: string,
  present: boolean,
  actorId: string | null
): AttendanceRow {
  const db = getDb()
  const member = db.select().from(s.members).where(eq(s.members.id, memberId)).get()
  if (!member) throw new AssemblyError('El miembro no existe')

  const existing = db
    .select()
    .from(s.attendanceRecords)
    .where(and(eq(s.attendanceRecords.assemblyId, assemblyId), eq(s.attendanceRecords.memberId, memberId)))
    .get()

  const now = new Date().toISOString()
  if (existing) {
    db.update(s.attendanceRecords)
      .set({ present, markedAt: now, updatedAt: now })
      .where(eq(s.attendanceRecords.id, existing.id))
      .run()
  } else {
    db.insert(s.attendanceRecords)
      .values({ id: uuidv7(), assemblyId, memberId, present, markedAt: now })
      .run()
  }

  bus.emit('assembly.attendance_changed', { actorId, assemblyId, memberId, present })
  return { ...memberDisplay(member), present }
}
