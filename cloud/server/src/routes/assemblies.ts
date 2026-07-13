import { Hono } from 'hono'
import type { AppContext } from '../env'
import { ApiError } from '../env'
import { audit } from '../audit'
import { createAssemblySchema, setAttendanceSchema } from '../schemas'
import { nowIso, uuidv7 } from '../util'

export const assemblyRoutes = new Hono<AppContext>()

assemblyRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.date, a.title, a.notes,
            (SELECT COUNT(*) FROM attendance_records r WHERE r.assembly_id = a.id AND r.present = 1) AS present_count
     FROM assemblies a WHERE a.deleted_at IS NULL ORDER BY a.date DESC`
  ).all<{ id: string; date: string; title: string | null; notes: string | null; present_count: number }>()
  return c.json(
    results.map((r) => ({ id: r.id, date: r.date, title: r.title, notes: r.notes, presentCount: r.present_count }))
  )
})

assemblyRoutes.post('/', async (c) => {
  const user = c.get('user')
  const input = createAssemblySchema.parse(await c.req.json())
  const id = uuidv7()
  const now = nowIso()
  await c.env.DB.prepare(
    'INSERT INTO assemblies (id, date, title, notes, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(id, input.date, input.title ?? null, input.notes ?? null, user.id, now, now)
    .run()
  await audit(c.env.DB, {
    userId: user.id,
    action: 'asamblea.alta',
    entityType: 'assembly',
    entityId: id,
    after: { date: input.date, title: input.title ?? null }
  })
  return c.json({ id, date: input.date, title: input.title ?? null, notes: input.notes ?? null, presentCount: 0 }, 201)
})

/** Lista de asistencia: todos los miembros activos + su marca en esta asamblea
 * (igual que el escritorio: la lista sale de members, no se dan de alta aparte). */
assemblyRoutes.get('/:id/attendance', async (c) => {
  const assemblyId = c.req.param('id')
  const assembly = await c.env.DB.prepare('SELECT id FROM assemblies WHERE id = ? AND deleted_at IS NULL')
    .bind(assemblyId)
    .first()
  if (!assembly) throw new ApiError(404, 'Asamblea no encontrada')

  const { results } = await c.env.DB.prepare(
    `SELECT m.id AS member_id, m.member_number, m.title, m.given_names, m.paternal_surname,
            m.maternal_surname, m.phone, r.present
     FROM members m
     JOIN member_statuses st ON st.id = m.status_id AND st.code = 'activo'
     LEFT JOIN attendance_records r ON r.member_id = m.id AND r.assembly_id = ?
     WHERE m.deleted_at IS NULL
     ORDER BY m.paternal_surname, m.maternal_surname, m.given_names`
  )
    .bind(assemblyId)
    .all<{
      member_id: string
      member_number: string
      title: string | null
      given_names: string
      paternal_surname: string | null
      maternal_surname: string | null
      phone: string | null
      present: number | null
    }>()
  return c.json(
    results.map((r) => ({
      memberId: r.member_id,
      memberNumber: r.member_number,
      title: r.title,
      givenNames: r.given_names,
      apellidos: [r.paternal_surname, r.maternal_surname].filter(Boolean).join(' ') || null,
      phone: r.phone,
      present: r.present === 1
    }))
  )
})

assemblyRoutes.put('/:id/attendance', async (c) => {
  const user = c.get('user')
  const assemblyId = c.req.param('id')
  const input = setAttendanceSchema.parse(await c.req.json())
  const now = nowIso()
  await c.env.DB.prepare(
    `INSERT INTO attendance_records (id, assembly_id, member_id, present, marked_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(assembly_id, member_id)
     DO UPDATE SET present = excluded.present, marked_at = excluded.marked_at, updated_at = excluded.updated_at`
  )
    .bind(uuidv7(), assemblyId, input.memberId, input.present ? 1 : 0, now, now, now)
    .run()
  await audit(c.env.DB, {
    userId: user.id,
    action: 'asamblea.asistencia',
    entityType: 'assembly',
    entityId: assemblyId,
    after: { memberId: input.memberId, present: input.present }
  })
  return c.json({ ok: true })
})

assemblyRoutes.delete('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const before = await c.env.DB.prepare('SELECT date, title FROM assemblies WHERE id = ? AND deleted_at IS NULL')
    .bind(id)
    .first<{ date: string; title: string | null }>()
  if (!before) throw new ApiError(404, 'Asamblea no encontrada')
  await c.env.DB.prepare('UPDATE assemblies SET deleted_at = ?, updated_at = ? WHERE id = ?')
    .bind(nowIso(), nowIso(), id)
    .run()
  await audit(c.env.DB, {
    userId: user.id,
    action: 'asamblea.papelera',
    entityType: 'assembly',
    entityId: id,
    before
  })
  return c.json({ ok: true })
})
