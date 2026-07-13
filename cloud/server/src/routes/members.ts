import { Hono } from 'hono'
import type { AppContext } from '../env'
import { ApiError } from '../env'
import { audit } from '../audit'
import { changeStatusSchema, createMemberSchema, updateMemberSchema } from '../schemas'
import { buildFullName, formatMemberNumber, getSetting, nowIso, setSetting, uuidv7 } from '../util'

export const memberRoutes = new Hono<AppContext>()

const LIST_SELECT = `
  SELECT m.id, m.member_number, m.title, m.given_names, m.paternal_surname, m.maternal_surname,
         m.full_name, m.phone, m.email, m.is_perito, st.code AS status_code, st.name AS status_name
  FROM members m JOIN member_statuses st ON st.id = m.status_id
  WHERE m.deleted_at IS NULL`

type ListRow = {
  id: string
  member_number: string
  title: string | null
  given_names: string
  paternal_surname: string | null
  maternal_surname: string | null
  full_name: string
  phone: string | null
  email: string | null
  is_perito: number
  status_code: string
  status_name: string
}

function toListItem(r: ListRow) {
  return {
    id: r.id,
    memberNumber: r.member_number,
    title: r.title,
    givenNames: r.given_names,
    paternalSurname: r.paternal_surname,
    maternalSurname: r.maternal_surname,
    fullName: r.full_name,
    phone: r.phone,
    email: r.email,
    statusCode: r.status_code,
    statusName: r.status_name,
    isPerito: r.is_perito === 1
  }
}

/** Normaliza para búsqueda sin acentos (D1 no trae el índice FTS5 del escritorio;
 * con ~40 miembros un LIKE por término es más que suficiente). */
function foldAccents(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

memberRoutes.get('/', async (c) => {
  const search = c.req.query('search')?.trim() ?? ''
  const statusCode = c.req.query('statusCode')

  let sql = LIST_SELECT
  const binds: unknown[] = []
  if (statusCode) {
    sql += ' AND st.code = ?'
    binds.push(statusCode)
  }
  sql += ' ORDER BY m.paternal_surname, m.maternal_surname, m.given_names'
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all<ListRow>()

  let items = results.map(toListItem)
  if (search) {
    const terms = foldAccents(search).split(/\s+/).filter(Boolean)
    items = items.filter((m) => {
      const haystack = foldAccents(`${m.memberNumber} ${m.fullName} ${m.phone ?? ''} ${m.email ?? ''}`)
      return terms.every((t) => haystack.includes(t))
    })
  }
  return c.json(items)
})

memberRoutes.post('/', async (c) => {
  const user = c.get('user')
  const input = createMemberSchema.parse(await c.req.json())
  const db = c.env.DB

  // Número de miembro automático, mismo algoritmo que el escritorio.
  const format = await getSetting(db, 'member_number_format', 'M-{seq:3}')
  let seq = await getSetting(db, 'next_member_seq', 1)
  let memberNumber = ''
  for (let i = 0; i < 100_000; i++, seq++) {
    const candidate = formatMemberNumber(format, seq)
    const clash = await db.prepare('SELECT id FROM members WHERE member_number = ?').bind(candidate).first()
    if (!clash) {
      memberNumber = candidate
      break
    }
  }
  if (!memberNumber) throw new ApiError(500, 'No se pudo asignar un número de miembro libre')
  await setSetting(db, 'next_member_seq', seq + 1)

  const status = await db
    .prepare("SELECT id FROM member_statuses WHERE code = 'activo'")
    .first<{ id: string }>()
  const membershipType = await db
    .prepare('SELECT id FROM membership_types WHERE is_active = 1 ORDER BY sort_order LIMIT 1')
    .first<{ id: string }>()
  if (!status || !membershipType) throw new ApiError(500, 'Faltan catálogos base (estado/tipo de membresía)')

  const id = uuidv7()
  const now = nowIso()
  const fullName = buildFullName(input.title, input.givenNames, input.paternalSurname, input.maternalSurname)
  await db
    .prepare(
      `INSERT INTO members (id, member_number, title, given_names, paternal_surname, maternal_surname,
         full_name, phone, membership_type_id, status_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      memberNumber,
      input.title ?? null,
      input.givenNames,
      input.paternalSurname ?? null,
      input.maternalSurname ?? null,
      fullName,
      input.phone ?? null,
      membershipType.id,
      status.id,
      now,
      now
    )
    .run()
  await db
    .prepare(
      'INSERT INTO member_status_history (id, member_id, status_id, changed_at, changed_by) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(uuidv7(), id, status.id, now, user.id)
    .run()
  await audit(db, {
    userId: user.id,
    action: 'miembro.alta',
    entityType: 'member',
    entityId: id,
    after: { memberNumber, fullName }
  })
  return c.json(await memberDetail(db, id), 201)
})

async function memberDetail(db: D1Database, id: string) {
  const row = await db
    .prepare(
      `SELECT m.*, st.code AS status_code, st.name AS status_name, mt.name AS membership_type_name
       FROM members m
       JOIN member_statuses st ON st.id = m.status_id
       JOIN membership_types mt ON mt.id = m.membership_type_id
       WHERE m.id = ? AND m.deleted_at IS NULL`
    )
    .bind(id)
    .first<Record<string, unknown>>()
  if (!row) throw new ApiError(404, 'Miembro no encontrado')
  return {
    id: row.id,
    memberNumber: row.member_number,
    title: row.title,
    givenNames: row.given_names,
    paternalSurname: row.paternal_surname,
    maternalSurname: row.maternal_surname,
    fullName: row.full_name,
    curp: row.curp,
    rfc: row.rfc,
    email: row.email,
    phone: row.phone,
    phoneHome: row.phone_home,
    street: row.street,
    city: row.city,
    state: row.state,
    zip: row.zip,
    university: row.university,
    degree: row.degree,
    specialty: row.specialty,
    masters: row.masters,
    doctorate: row.doctorate,
    company: row.company,
    position: row.position,
    isPerito: row.is_perito === 1,
    peritoNumber: row.perito_number,
    statusCode: row.status_code,
    statusName: row.status_name,
    membershipTypeName: row.membership_type_name,
    joinedAt: row.joined_at,
    observations: row.observations,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

memberRoutes.get('/:id', async (c) => c.json(await memberDetail(c.env.DB, c.req.param('id'))))

memberRoutes.get('/:id/history', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT st.code AS status_code, st.name AS status_name, h.changed_at, h.reason, u.full_name AS changed_by_name
     FROM member_status_history h
     JOIN member_statuses st ON st.id = h.status_id
     LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.member_id = ? ORDER BY h.changed_at DESC`
  )
    .bind(c.req.param('id'))
    .all<{
      status_code: string
      status_name: string
      changed_at: string
      reason: string | null
      changed_by_name: string | null
    }>()
  return c.json(
    results.map((r) => ({
      statusCode: r.status_code,
      statusName: r.status_name,
      changedAt: r.changed_at,
      reason: r.reason,
      changedByName: r.changed_by_name
    }))
  )
})

const FIELD_COLUMNS: Record<string, string> = {
  title: 'title',
  givenNames: 'given_names',
  paternalSurname: 'paternal_surname',
  maternalSurname: 'maternal_surname',
  curp: 'curp',
  rfc: 'rfc',
  email: 'email',
  phone: 'phone',
  phoneHome: 'phone_home',
  street: 'street',
  city: 'city',
  state: 'state',
  zip: 'zip',
  university: 'university',
  degree: 'degree',
  specialty: 'specialty',
  masters: 'masters',
  doctorate: 'doctorate',
  company: 'company',
  position: 'position',
  isPerito: 'is_perito',
  peritoNumber: 'perito_number',
  joinedAt: 'joined_at',
  observations: 'observations'
}

memberRoutes.patch('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const db = c.env.DB
  const before = await memberDetail(db, id)
  const patch = updateMemberSchema.parse(await c.req.json())

  const sets: string[] = []
  const binds: unknown[] = []
  for (const [field, value] of Object.entries(patch)) {
    const col = FIELD_COLUMNS[field]
    if (!col) continue
    sets.push(`${col} = ?`)
    binds.push(typeof value === 'boolean' ? (value ? 1 : 0) : value)
  }
  if (sets.length === 0) return c.json(before)

  // full_name se reconstruye siempre que cambie alguno de sus componentes.
  const merged = { ...before, ...patch }
  sets.push('full_name = ?')
  binds.push(
    buildFullName(
      merged.title as string | null,
      merged.givenNames as string,
      merged.paternalSurname as string | null,
      merged.maternalSurname as string | null
    )
  )
  sets.push('updated_at = ?')
  binds.push(nowIso())
  binds.push(id)
  await db.prepare(`UPDATE members SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run()

  const after = await memberDetail(db, id)
  await audit(db, { userId: user.id, action: 'miembro.edicion', entityType: 'member', entityId: id, before, after })
  return c.json(after)
})

memberRoutes.post('/:id/status', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const db = c.env.DB
  const input = changeStatusSchema.parse(await c.req.json())
  const before = await memberDetail(db, id)

  const status = await db
    .prepare('SELECT id, code, name FROM member_statuses WHERE code = ? AND is_active = 1')
    .bind(input.statusCode)
    .first<{ id: string; code: string; name: string }>()
  if (!status) throw new ApiError(400, 'Estado no válido')

  const now = nowIso()
  await db.prepare('UPDATE members SET status_id = ?, updated_at = ? WHERE id = ?').bind(status.id, now, id).run()
  await db
    .prepare(
      'INSERT INTO member_status_history (id, member_id, status_id, changed_at, reason, changed_by) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(uuidv7(), id, status.id, now, input.reason ?? null, user.id)
    .run()
  await audit(db, {
    userId: user.id,
    action: 'miembro.cambio_estado',
    entityType: 'member',
    entityId: id,
    before: { status: before.statusCode },
    after: { status: status.code, reason: input.reason ?? null }
  })
  return c.json(await memberDetail(db, id))
})

memberRoutes.delete('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const db = c.env.DB
  const before = await memberDetail(db, id)
  await db.prepare('UPDATE members SET deleted_at = ?, updated_at = ? WHERE id = ?').bind(nowIso(), nowIso(), id).run()
  await audit(db, {
    userId: user.id,
    action: 'miembro.papelera',
    entityType: 'member',
    entityId: id,
    before: { memberNumber: before.memberNumber, fullName: before.fullName }
  })
  return c.json({ ok: true })
})

memberRoutes.get('/:id/payments', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, member_id, year, kind, amount_cents, paid_at, method, concept, reference,
            receipt_folio, observations, created_at
     FROM payments WHERE member_id = ? AND deleted_at IS NULL ORDER BY paid_at DESC, created_at DESC`
  )
    .bind(c.req.param('id'))
    .all<Record<string, unknown>>()
  return c.json(
    results.map((r) => ({
      id: r.id,
      memberId: r.member_id,
      year: r.year,
      kind: r.kind,
      amountCents: r.amount_cents,
      paidAt: r.paid_at,
      method: r.method,
      concept: r.concept,
      reference: r.reference,
      receiptFolio: r.receipt_folio,
      observations: r.observations,
      createdAt: r.created_at
    }))
  )
})
