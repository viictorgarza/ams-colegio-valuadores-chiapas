import { Hono } from 'hono'
import type { AppContext } from '../env'

export const systemRoutes = new Hono<AppContext>()

systemRoutes.get('/organization', async (c) => {
  const row = await c.env.DB.prepare(
    'SELECT name, short_name, city, state, phone, email FROM organization LIMIT 1'
  ).first<{
    name: string
    short_name: string | null
    city: string | null
    state: string | null
    phone: string | null
    email: string | null
  }>()
  return c.json(
    row
      ? { name: row.name, shortName: row.short_name, city: row.city, state: row.state, phone: row.phone, email: row.email }
      : null
  )
})

/** Estadísticas del dashboard (espejo de los cuadritos del escritorio, sin la
 * parte de documentos que es fase 2 en la nube). */
systemRoutes.get('/stats', async (c) => {
  const db = c.env.DB
  const year = new Date().getFullYear()

  const membersCount = await db
    .prepare('SELECT COUNT(*) AS n FROM members WHERE deleted_at IS NULL')
    .first<{ n: number }>()

  const fee = await db
    .prepare('SELECT amount_cents FROM annual_fees WHERE year = ? AND membership_type_id IS NULL')
    .bind(year)
    .first<{ amount_cents: number }>()
  const feeCents = fee?.amount_cents ?? 0

  // Pendientes de pago: mismo criterio derivado que /payments/annuities.
  const { results: members } = await db
    .prepare(
      `SELECT m.id, mt.is_fee_exempt FROM members m
       JOIN membership_types mt ON mt.id = m.membership_type_id WHERE m.deleted_at IS NULL`
    )
    .all<{ id: string; is_fee_exempt: number }>()
  const { results: payments } = await db
    .prepare(
      `SELECT member_id, kind, amount_cents FROM payments
       WHERE year = ? AND deleted_at IS NULL AND concept IS NULL`
    )
    .bind(year)
    .all<{ member_id: string; kind: string; amount_cents: number }>()
  const paid = new Map<string, { cents: number; inKind: boolean }>()
  for (const p of payments) {
    const acc = paid.get(p.member_id) ?? { cents: 0, inKind: false }
    acc.cents += p.amount_cents
    if (p.kind !== 'pago') acc.inKind = true
    paid.set(p.member_id, acc)
  }
  let pendingCount = 0
  for (const m of members) {
    if (m.is_fee_exempt === 1) continue
    const acc = paid.get(m.id)
    const covered = acc && (acc.inKind || (feeCents > 0 && acc.cents >= feeCents))
    if (!covered) pendingCount++
  }

  const { results: upcoming } = await db
    .prepare(
      `SELECT id, title, event_type, starts_at, location FROM events
       WHERE deleted_at IS NULL AND starts_at >= ? ORDER BY starts_at LIMIT 6`
    )
    .bind(new Date().toISOString())
    .all<{ id: string; title: string; event_type: string; starts_at: string; location: string | null }>()

  return c.json({
    membersCount: membersCount?.n ?? 0,
    pendingPayments: pendingCount,
    year,
    upcomingEvents: upcoming.map((e) => ({
      id: e.id,
      title: e.title,
      eventType: e.event_type,
      startsAt: e.starts_at,
      location: e.location
    }))
  })
})
