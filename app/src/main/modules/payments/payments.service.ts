import { and, eq, isNull } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { getDb } from '../../core/db'
import * as s from '../../core/db/schema'
import { getSetting, setSetting } from '../../core/db/settings'
import { bus } from '../../core/events/bus'
import type {
  AnnualFee,
  CreatePaymentInput,
  MemberAnnuity,
  Payment,
  SetAnnualFeeInput
} from '../../../shared/contracts'

export class PaymentError extends Error {}

function toAnnualFee(row: typeof s.annualFees.$inferSelect): AnnualFee {
  return {
    id: row.id,
    year: row.year,
    membershipTypeId: row.membershipTypeId,
    amountCents: row.amountCents,
    notes: row.notes
  }
}

function toPayment(row: typeof s.payments.$inferSelect): Payment {
  return {
    id: row.id,
    memberId: row.memberId,
    year: row.year,
    kind: row.kind,
    amountCents: row.amountCents,
    paidAt: row.paidAt,
    method: row.method,
    concept: row.concept,
    reference: row.reference,
    receiptFolio: row.receiptFolio,
    observations: row.observations,
    createdAt: row.createdAt
  }
}

export function getAnnualFee(year: number): AnnualFee | null {
  const row = getDb()
    .select()
    .from(s.annualFees)
    .where(and(eq(s.annualFees.year, year), isNull(s.annualFees.membershipTypeId)))
    .get()
  return row ? toAnnualFee(row) : null
}

export function setAnnualFee(input: SetAnnualFeeInput, actorId: string | null): AnnualFee {
  const db = getDb()
  const existing = getAnnualFee(input.year)
  if (existing) {
    db.update(s.annualFees)
      .set({ amountCents: input.amountCents, notes: input.notes ?? null, updatedAt: new Date().toISOString() })
      .where(eq(s.annualFees.id, existing.id))
      .run()
  } else {
    db.insert(s.annualFees)
      .values({ id: uuidv7(), year: input.year, amountCents: input.amountCents, notes: input.notes ?? null })
      .run()
  }
  bus.emit('annual_fee.set', { actorId, year: input.year, amountCents: input.amountCents })
  const fee = getAnnualFee(input.year)
  if (!fee) throw new PaymentError('No se pudo leer la cuota tras guardarla')
  return fee
}

export function listPaymentsByMember(memberId: string): Payment[] {
  return getDb()
    .select()
    .from(s.payments)
    .where(and(eq(s.payments.memberId, memberId), isNull(s.payments.deletedAt)))
    .all()
    .map(toPayment)
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt))
}

function nextReceiptFolio(): string {
  const seq = getSetting('next_receipt_folio', 1)
  setSetting('next_receipt_folio', seq + 1)
  return `R-${String(seq).padStart(4, '0')}`
}

export function createPayment(
  input: CreatePaymentInput,
  actorId: string | null
): { payment: Payment; memberFullName: string; memberNumber: string } {
  const db = getDb()
  const member = db.select().from(s.members).where(eq(s.members.id, input.memberId)).get()
  if (!member || member.deletedAt) throw new PaymentError('El miembro no existe o está en la papelera')

  const id = uuidv7()
  const folio = input.kind === 'pago' ? nextReceiptFolio() : null
  db.insert(s.payments)
    .values({
      id,
      memberId: input.memberId,
      year: input.year,
      kind: input.kind,
      amountCents: input.amountCents,
      paidAt: input.paidAt,
      method: input.method,
      concept: input.concept ?? null,
      reference: input.reference ?? null,
      receiptFolio: folio,
      observations: input.observations ?? null,
      createdBy: actorId
    })
    .run()

  const row = db.select().from(s.payments).where(eq(s.payments.id, id)).get()!
  const payment = toPayment(row)
  bus.emit('payment.created', {
    actorId,
    paymentId: id,
    memberId: input.memberId,
    after: payment as unknown as Record<string, unknown>
  })
  return { payment, memberFullName: member.fullName, memberNumber: member.memberNumber }
}

export function getPaymentWithMember(
  id: string
): { payment: Payment; memberFullName: string; memberNumber: string } | null {
  const db = getDb()
  const row = db.select().from(s.payments).where(eq(s.payments.id, id)).get()
  if (!row || row.deletedAt) return null
  const member = db.select().from(s.members).where(eq(s.members.id, row.memberId)).get()
  if (!member) return null
  return { payment: toPayment(row), memberFullName: member.fullName, memberNumber: member.memberNumber }
}

export function removePayment(id: string, actorId: string | null): void {
  const db = getDb()
  const row = db.select().from(s.payments).where(eq(s.payments.id, id)).get()
  if (!row || row.deletedAt) throw new PaymentError('El pago no existe o ya está en la papelera')
  db.update(s.payments)
    .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(s.payments.id, id))
    .run()
  bus.emit('payment.deleted', {
    actorId,
    paymentId: id,
    memberId: row.memberId,
    before: toPayment(row) as unknown as Record<string, unknown>
  })
}

/** Anualidades por año (docs/03 §4.4): estado calculado en memoria, nunca almacenado. */
export function annuitiesByYear(year: number): MemberAnnuity[] {
  const db = getDb()
  const generalFee = getAnnualFee(year)?.amountCents ?? 0

  const members = db
    .select({
      id: s.members.id,
      memberNumber: s.members.memberNumber,
      title: s.members.title,
      fullName: s.members.fullName,
      givenNames: s.members.givenNames,
      paternalSurname: s.members.paternalSurname,
      maternalSurname: s.members.maternalSurname,
      phone: s.members.phone,
      joinedAt: s.members.joinedAt,
      isFeeExempt: s.membershipTypes.isFeeExempt
    })
    .from(s.members)
    .innerJoin(s.membershipTypes, eq(s.members.membershipTypeId, s.membershipTypes.id))
    .where(isNull(s.members.deletedAt))
    .all()

  const paidByMember = new Map<string, { cents: number; inKind: boolean }>()
  const paymentRows = db
    .select({ memberId: s.payments.memberId, kind: s.payments.kind, amountCents: s.payments.amountCents })
    .from(s.payments)
    // concept NULL = cuota anual (cuenta para el estado); concept con texto = "Otro", no cuenta.
    .where(and(eq(s.payments.year, year), isNull(s.payments.deletedAt), isNull(s.payments.concept)))
    .all()
  for (const p of paymentRows) {
    const acc = paidByMember.get(p.memberId) ?? { cents: 0, inKind: false }
    acc.cents += p.amountCents
    if (p.kind !== 'pago') acc.inKind = true
    paidByMember.set(p.memberId, acc)
  }

  const result: MemberAnnuity[] = []
  for (const m of members) {
    const paid = paidByMember.get(m.id) ?? { cents: 0, inKind: false }
    const status =
      m.isFeeExempt || paid.inKind
        ? m.isFeeExempt
          ? ('exenta' as const)
          : ('cubierta' as const)
        : paid.cents >= generalFee && generalFee > 0
          ? ('cubierta' as const)
          : paid.cents > 0
            ? ('parcial' as const)
            : ('pendiente' as const)
    result.push({
      memberId: m.id,
      memberNumber: m.memberNumber,
      title: m.title,
      fullName: m.fullName,
      fullNameNoTitle: [m.givenNames, m.paternalSurname, m.maternalSurname].filter(Boolean).join(' '),
      givenNames: m.givenNames,
      apellidos: [m.paternalSurname, m.maternalSurname].filter(Boolean).join(' ') || null,
      phone: m.phone,
      year,
      feeCents: generalFee,
      paidCents: paid.cents,
      hasInKindSupport: paid.inKind,
      status
    })
  }
  return result.sort((a, b) => a.fullName.localeCompare(b.fullName))
}
