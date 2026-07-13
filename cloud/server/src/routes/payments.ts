import { Hono } from 'hono'
import type { AppContext } from '../env'
import { ApiError } from '../env'
import { audit } from '../audit'
import { createPaymentSchema, setAnnualFeeSchema } from '../schemas'
import { getSetting, nowIso, setSetting, uuidv7 } from '../util'

export const paymentRoutes = new Hono<AppContext>()

async function getAnnualFee(db: D1Database, year: number) {
  return db
    .prepare('SELECT id, year, membership_type_id, amount_cents, notes FROM annual_fees WHERE year = ? AND membership_type_id IS NULL')
    .bind(year)
    .first<{ id: string; year: number; membership_type_id: string | null; amount_cents: number; notes: string | null }>()
}

/** Estado de anualidad por miembro, misma lógica derivada (nunca almacenada)
 * que payments.service.ts del escritorio. */
paymentRoutes.get('/annuities', async (c) => {
  const year = Number(c.req.query('year') ?? new Date().getFullYear())
  const db = c.env.DB
  const generalFee = (await getAnnualFee(db, year))?.amount_cents ?? 0

  const { results: members } = await db
    .prepare(
      `SELECT m.id, m.member_number, m.title, m.full_name, m.given_names, m.paternal_surname,
              m.maternal_surname, m.phone, mt.is_fee_exempt
       FROM members m JOIN membership_types mt ON mt.id = m.membership_type_id
       WHERE m.deleted_at IS NULL`
    )
    .all<{
      id: string
      member_number: string
      title: string | null
      full_name: string
      given_names: string
      paternal_surname: string | null
      maternal_surname: string | null
      phone: string | null
      is_fee_exempt: number
    }>()

  const { results: paymentRows } = await db
    .prepare(
      `SELECT member_id, kind, amount_cents FROM payments
       WHERE year = ? AND deleted_at IS NULL AND concept IS NULL`
    )
    .bind(year)
    .all<{ member_id: string; kind: string; amount_cents: number }>()

  const paidByMember = new Map<string, { cents: number; inKind: boolean }>()
  for (const p of paymentRows) {
    const acc = paidByMember.get(p.member_id) ?? { cents: 0, inKind: false }
    acc.cents += p.amount_cents
    if (p.kind !== 'pago') acc.inKind = true
    paidByMember.set(p.member_id, acc)
  }

  const result = members.map((m) => {
    const paid = paidByMember.get(m.id) ?? { cents: 0, inKind: false }
    const isExempt = m.is_fee_exempt === 1
    const status = isExempt
      ? 'exenta'
      : paid.inKind
        ? 'cubierta'
        : paid.cents >= generalFee && generalFee > 0
          ? 'cubierta'
          : paid.cents > 0
            ? 'parcial'
            : 'pendiente'
    return {
      memberId: m.id,
      memberNumber: m.member_number,
      title: m.title,
      fullName: m.full_name,
      fullNameNoTitle: [m.given_names, m.paternal_surname, m.maternal_surname].filter(Boolean).join(' '),
      givenNames: m.given_names,
      apellidos: [m.paternal_surname, m.maternal_surname].filter(Boolean).join(' ') || null,
      phone: m.phone,
      year,
      feeCents: generalFee,
      paidCents: paid.cents,
      hasInKindSupport: paid.inKind,
      status
    }
  })
  result.sort((a, b) => a.fullName.localeCompare(b.fullName))
  return c.json(result)
})

paymentRoutes.get('/annual-fee', async (c) => {
  const year = Number(c.req.query('year') ?? new Date().getFullYear())
  const fee = await getAnnualFee(c.env.DB, year)
  return c.json(
    fee
      ? { id: fee.id, year: fee.year, membershipTypeId: fee.membership_type_id, amountCents: fee.amount_cents, notes: fee.notes }
      : null
  )
})

paymentRoutes.put('/annual-fee', async (c) => {
  const user = c.get('user')
  const input = setAnnualFeeSchema.parse(await c.req.json())
  const db = c.env.DB
  const existing = await getAnnualFee(db, input.year)
  if (existing) {
    await db
      .prepare('UPDATE annual_fees SET amount_cents = ?, notes = ?, updated_at = ? WHERE id = ?')
      .bind(input.amountCents, input.notes ?? existing.notes, nowIso(), existing.id)
      .run()
  } else {
    await db
      .prepare('INSERT INTO annual_fees (id, year, amount_cents, notes) VALUES (?, ?, ?, ?)')
      .bind(uuidv7(), input.year, input.amountCents, input.notes ?? null)
      .run()
  }
  await audit(db, {
    userId: user.id,
    action: 'cuota.actualizacion',
    entityType: 'annual_fee',
    entityId: String(input.year),
    after: { amountCents: input.amountCents }
  })
  const fee = await getAnnualFee(db, input.year)
  return c.json({ id: fee!.id, year: fee!.year, membershipTypeId: fee!.membership_type_id, amountCents: fee!.amount_cents, notes: fee!.notes })
})

paymentRoutes.post('/', async (c) => {
  const user = c.get('user')
  const input = createPaymentSchema.parse(await c.req.json())
  const db = c.env.DB

  const member = await db
    .prepare('SELECT id FROM members WHERE id = ? AND deleted_at IS NULL')
    .bind(input.memberId)
    .first()
  if (!member) throw new ApiError(404, 'Miembro no encontrado')

  // Folio secuencial de recibo, misma secuencia que el escritorio. El PDF del
  // recibo se sigue generando solo en la laptop (fase 2 en la nube).
  const folio = await getSetting(db, 'next_receipt_folio', 1)
  await setSetting(db, 'next_receipt_folio', folio + 1)

  const id = uuidv7()
  const now = nowIso()
  await db
    .prepare(
      `INSERT INTO payments (id, member_id, year, kind, amount_cents, paid_at, method, concept,
         reference, receipt_folio, observations, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.memberId,
      input.year,
      input.kind,
      input.amountCents,
      input.paidAt,
      input.method,
      input.concept ?? null,
      input.reference ?? null,
      String(folio),
      input.observations ?? null,
      user.id,
      now,
      now
    )
    .run()
  await audit(db, {
    userId: user.id,
    action: 'pago.alta',
    entityType: 'payment',
    entityId: id,
    after: { memberId: input.memberId, year: input.year, amountCents: input.amountCents, kind: input.kind }
  })
  const row = await db
    .prepare(
      `SELECT id, member_id, year, kind, amount_cents, paid_at, method, concept, reference,
              receipt_folio, observations, created_at FROM payments WHERE id = ?`
    )
    .bind(id)
    .first<Record<string, unknown>>()
  return c.json(
    {
      id: row!.id,
      memberId: row!.member_id,
      year: row!.year,
      kind: row!.kind,
      amountCents: row!.amount_cents,
      paidAt: row!.paid_at,
      method: row!.method,
      concept: row!.concept,
      reference: row!.reference,
      receiptFolio: row!.receipt_folio,
      observations: row!.observations,
      createdAt: row!.created_at
    },
    201
  )
})

paymentRoutes.delete('/:id', async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const db = c.env.DB
  const before = await db
    .prepare('SELECT id, member_id, year, amount_cents FROM payments WHERE id = ? AND deleted_at IS NULL')
    .bind(id)
    .first<{ id: string; member_id: string; year: number; amount_cents: number }>()
  if (!before) throw new ApiError(404, 'Pago no encontrado')
  await db.prepare('UPDATE payments SET deleted_at = ?, updated_at = ? WHERE id = ?').bind(nowIso(), nowIso(), id).run()
  await audit(db, {
    userId: user.id,
    action: 'pago.papelera',
    entityType: 'payment',
    entityId: id,
    before: { memberId: before.member_id, year: before.year, amountCents: before.amount_cents }
  })
  return c.json({ ok: true })
})
