import { z } from 'zod'
import { contract } from './core'

export const paymentKindSchema = z.enum(['pago', 'apoyo_en_especie', 'condonacion'])
export const paymentMethodSchema = z.enum(['efectivo', 'transferencia', 'otro'])

export const annualFeeSchema = z.object({
  id: z.string(),
  year: z.number(),
  membershipTypeId: z.string().nullable(),
  amountCents: z.number(),
  notes: z.string().nullable()
})
export type AnnualFee = z.output<typeof annualFeeSchema>

export const setAnnualFeeSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  amountCents: z.number().int().min(0),
  notes: z.string().trim().min(1).nullable().optional()
})
export type SetAnnualFeeInput = z.output<typeof setAnnualFeeSchema>

export const paymentSchema = z.object({
  id: z.string(),
  memberId: z.string(),
  year: z.number(),
  kind: paymentKindSchema,
  amountCents: z.number(),
  paidAt: z.string(),
  method: paymentMethodSchema.nullable(),
  concept: z.string().nullable(),
  reference: z.string().nullable(),
  receiptFolio: z.string().nullable(),
  observations: z.string().nullable(),
  createdAt: z.string()
})
export type Payment = z.output<typeof paymentSchema>

export const createPaymentSchema = z.object({
  memberId: z.string(),
  year: z.number().int().min(2000).max(2100),
  kind: paymentKindSchema,
  amountCents: z.number().int().min(0),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: paymentMethodSchema.nullable(),
  concept: z.string().trim().min(1).nullable().optional(),
  reference: z.string().trim().min(1).nullable().optional(),
  observations: z.string().trim().min(1).nullable().optional()
})
export type CreatePaymentInput = z.output<typeof createPaymentSchema>

/** Estado de anualidad calculado (docs/03 §4.4) — nunca se almacena. */
export const annuityStatusSchema = z.enum(['exenta', 'cubierta', 'parcial', 'pendiente'])

export const memberAnnuitySchema = z.object({
  memberId: z.string(),
  memberNumber: z.string(),
  title: z.string().nullable(),
  fullName: z.string(),
  fullNameNoTitle: z.string(),
  givenNames: z.string(),
  apellidos: z.string().nullable(),
  phone: z.string().nullable(),
  year: z.number(),
  feeCents: z.number(),
  paidCents: z.number(),
  hasInKindSupport: z.boolean(),
  status: annuityStatusSchema
})
export type MemberAnnuity = z.output<typeof memberAnnuitySchema>

export const paymentsContracts = {
  annuitiesByYear: contract(
    'payments:annuities-by-year',
    z.object({ year: z.number() }),
    z.array(memberAnnuitySchema)
  ),
  listByMember: contract(
    'payments:list-by-member',
    z.object({ memberId: z.string() }),
    z.array(paymentSchema)
  ),
  create: contract(
    'payments:create',
    createPaymentSchema,
    z.object({ payment: paymentSchema, receiptPath: z.string().nullable() })
  ),
  remove: contract('payments:remove', z.object({ id: z.string() }), z.object({ ok: z.literal(true) })),
  openReceipt: contract('payments:open-receipt', z.object({ id: z.string() }), z.object({ ok: z.literal(true) })),
  downloadReceipt: contract(
    'payments:download-receipt',
    z.object({ id: z.string() }),
    z.object({ path: z.string().nullable() })
  ),
  getAnnualFee: contract('payments:get-annual-fee', z.object({ year: z.number() }), annualFeeSchema.nullable()),
  setAnnualFee: contract('payments:set-annual-fee', setAnnualFeeSchema, annualFeeSchema)
}
