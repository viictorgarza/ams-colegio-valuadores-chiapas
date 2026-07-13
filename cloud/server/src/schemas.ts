import { z } from 'zod'

// Espejo del subconjunto MVP de app/src/shared/contracts/*.ts (misma forma y
// mismas validaciones). Se duplica a propósito: son paquetes separados y el
// escritorio no debe depender del build de la nube ni al revés.

export const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/
export const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}([A-Z0-9]{3})?$/

const curpField = z.string().trim().toUpperCase().regex(CURP_REGEX, 'CURP inválida').nullable()
const rfcField = z.string().trim().toUpperCase().regex(RFC_REGEX, 'RFC inválido').nullable()
const optionalText = z.string().trim().min(1).nullable()
const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)')
  .nullable()

export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1)
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, 'La contraseña nueva debe tener al menos 6 caracteres')
})

export const createMemberSchema = z.object({
  title: optionalText.optional(),
  givenNames: z.string().trim().min(1, 'El nombre es obligatorio'),
  paternalSurname: optionalText.optional(),
  maternalSurname: optionalText.optional(),
  phone: optionalText.optional()
})

export const updateMemberSchema = z
  .object({
    title: optionalText,
    givenNames: z.string().trim().min(1, 'El nombre es obligatorio'),
    paternalSurname: optionalText,
    maternalSurname: optionalText,
    curp: curpField,
    rfc: rfcField,
    email: z.string().trim().email('Correo inválido').nullable(),
    phone: optionalText,
    phoneHome: optionalText,
    street: optionalText,
    city: optionalText,
    state: optionalText,
    zip: optionalText,
    university: optionalText,
    degree: optionalText,
    specialty: optionalText,
    masters: optionalText,
    doctorate: optionalText,
    company: optionalText,
    position: optionalText,
    isPerito: z.boolean(),
    peritoNumber: optionalText,
    joinedAt: dateField,
    observations: optionalText
  })
  .partial()

export const changeStatusSchema = z.object({
  statusCode: z.string().min(1),
  reason: z.string().trim().min(1).nullable().optional()
})

export const createPaymentSchema = z.object({
  memberId: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  kind: z.enum(['pago', 'apoyo_en_especie', 'condonacion']),
  amountCents: z.number().int().min(0),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.enum(['efectivo', 'transferencia', 'otro']).nullable(),
  concept: z.string().trim().min(1).nullable().optional(),
  reference: z.string().trim().min(1).nullable().optional(),
  observations: z.string().trim().min(1).nullable().optional()
})

export const setAnnualFeeSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  amountCents: z.number().int().min(0),
  notes: z.string().trim().min(1).nullable().optional()
})

export const createEventSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio'),
  eventType: z.enum(['reunion', 'asamblea', 'ponencia', 'otro']),
  startsAt: z.string().min(1, 'La fecha y hora son obligatorias'),
  endsAt: z.string().trim().min(1).nullable().optional(),
  location: z.string().trim().min(1).nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional()
})

export const updateEventSchema = createEventSchema.partial()

export const createAssemblySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)'),
  title: z.string().trim().min(1).nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional()
})

export const setAttendanceSchema = z.object({
  memberId: z.string().min(1),
  present: z.boolean()
})
