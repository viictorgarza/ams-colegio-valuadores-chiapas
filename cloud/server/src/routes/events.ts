import { Hono } from 'hono'
import type { AppContext } from '../env'
import { ApiError } from '../env'
import { audit } from '../audit'
import { createEventSchema, updateEventSchema } from '../schemas'
import { nowIso, uuidv7 } from '../util'

export const eventRoutes = new Hono<AppContext>()

type EventRow = {
  id: string
  title: string
  event_type: string
  starts_at: string
  ends_at: string | null
  location: string | null
  notes: string | null
  created_at: string
}

function toEvent(r: EventRow) {
  return {
    id: r.id,
    title: r.title,
    eventType: r.event_type,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    location: r.location,
    notes: r.notes,
    createdAt: r.created_at
  }
}

const SELECT = `SELECT id, title, event_type, starts_at, ends_at, location, notes, created_at
                FROM events WHERE deleted_at IS NULL`

eventRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(`${SELECT} ORDER BY starts_at`).all<EventRow>()
  return c.json(results.map(toEvent))
})

eventRoutes.post('/', async (c) => {
  const user = c.get('user')
  const input = createEventSchema.parse(await c.req.json())
  const id = uuidv7()
  const now = nowIso()
  await c.env.DB.prepare(
    `INSERT INTO events (id, title, event_type, starts_at, ends_at, location, notes, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      input.title,
      input.eventType,
      input.startsAt,
      input.endsAt ?? null,
      input.location ?? null,
      input.notes ?? null,
      user.id,
      now,
      now
    )
    .run()
  await audit(c.env.DB, {
    userId: user.id,
    action: 'evento.alta',
    entityType: 'event',
    entityId: id,
    after: { title: input.title, startsAt: input.startsAt }
  })
  const row = await c.env.DB.prepare(`${SELECT} AND id = ?`).bind(id).first<EventRow>()
  return c.json(toEvent(row!), 201)
})

eventRoutes.patch('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const db = c.env.DB
  const before = await db.prepare(`${SELECT} AND id = ?`).bind(id).first<EventRow>()
  if (!before) throw new ApiError(404, 'Evento no encontrado')

  const patch = updateEventSchema.parse(await c.req.json())
  const cols: Record<string, string> = {
    title: 'title',
    eventType: 'event_type',
    startsAt: 'starts_at',
    endsAt: 'ends_at',
    location: 'location',
    notes: 'notes'
  }
  const sets: string[] = []
  const binds: unknown[] = []
  for (const [field, value] of Object.entries(patch)) {
    const col = cols[field]
    if (!col) continue
    sets.push(`${col} = ?`)
    binds.push(value)
  }
  if (sets.length > 0) {
    sets.push('updated_at = ?')
    binds.push(nowIso(), id)
    await db.prepare(`UPDATE events SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run()
  }
  const after = await db.prepare(`${SELECT} AND id = ?`).bind(id).first<EventRow>()
  await audit(db, {
    userId: user.id,
    action: 'evento.edicion',
    entityType: 'event',
    entityId: id,
    before: toEvent(before),
    after: toEvent(after!)
  })
  return c.json(toEvent(after!))
})

eventRoutes.delete('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const before = await c.env.DB.prepare(`${SELECT} AND id = ?`).bind(id).first<EventRow>()
  if (!before) throw new ApiError(404, 'Evento no encontrado')
  await c.env.DB.prepare('UPDATE events SET deleted_at = ?, updated_at = ? WHERE id = ?')
    .bind(nowIso(), nowIso(), id)
    .run()
  await audit(c.env.DB, {
    userId: user.id,
    action: 'evento.papelera',
    entityType: 'event',
    entityId: id,
    before: { title: before.title, startsAt: before.starts_at }
  })
  return c.json({ ok: true })
})
