import { z } from 'zod'
import { contract } from './core'

// Validaciones de identidad mexicanas: solo se exigen cuando el campo trae valor.
export const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/
// La homoclave (últimos 3) es opcional: no siempre se conoce al capturar el CURP.
export const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}([A-Z0-9]{3})?$/

const curpField = z.string().trim().toUpperCase().regex(CURP_REGEX, 'CURP inválida').nullable()
const rfcField = z.string().trim().toUpperCase().regex(RFC_REGEX, 'RFC inválido').nullable()
const optionalText = z.string().trim().min(1).nullable()
const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)')
  .nullable()

export const memberFiltersSchema = z.object({
  search: z.string().trim().optional(),
  statusCode: z.string().optional(),
  isPerito: z.boolean().optional(),
  hasMasters: z.boolean().optional(),
  hasDoctorate: z.boolean().optional()
})
export type MemberFilters = z.output<typeof memberFiltersSchema>

export const memberListItemSchema = z.object({
  id: z.string(),
  memberNumber: z.string(),
  title: z.string().nullable(),
  givenNames: z.string(),
  paternalSurname: z.string().nullable(),
  maternalSurname: z.string().nullable(),
  fullName: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  statusCode: z.string(),
  statusName: z.string(),
  isPerito: z.boolean()
})
export type MemberListItem = z.output<typeof memberListItemSchema>

const editableFields = {
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
}

export const createMemberSchema = z.object({
  title: optionalText.optional(),
  givenNames: z.string().trim().min(1, 'El nombre es obligatorio'),
  paternalSurname: optionalText.optional(),
  maternalSurname: optionalText.optional(),
  phone: optionalText.optional()
})
export type CreateMemberInput = z.output<typeof createMemberSchema>

export const updateMemberSchema = z.object(editableFields).partial()
export type UpdateMemberInput = z.output<typeof updateMemberSchema>

export const statusHistoryEntrySchema = z.object({
  statusCode: z.string(),
  statusName: z.string(),
  changedAt: z.string(),
  reason: z.string().nullable(),
  changedByName: z.string().nullable()
})

export const memberDetailSchema = z.object({
  id: z.string(),
  memberNumber: z.string(),
  title: z.string().nullable(),
  givenNames: z.string(),
  paternalSurname: z.string().nullable(),
  maternalSurname: z.string().nullable(),
  fullName: z.string(),
  curp: z.string().nullable(),
  rfc: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  phoneHome: z.string().nullable(),
  street: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  university: z.string().nullable(),
  degree: z.string().nullable(),
  specialty: z.string().nullable(),
  masters: z.string().nullable(),
  doctorate: z.string().nullable(),
  company: z.string().nullable(),
  position: z.string().nullable(),
  isPerito: z.boolean(),
  peritoNumber: z.string().nullable(),
  statusCode: z.string(),
  statusName: z.string(),
  membershipTypeName: z.string(),
  joinedAt: z.string().nullable(),
  observations: z.string().nullable(),
  createdAt: z.string(),
  history: z.array(statusHistoryEntrySchema)
})
export type MemberDetail = z.output<typeof memberDetailSchema>

export const membersContracts = {
  list: contract('members:list', memberFiltersSchema, z.array(memberListItemSchema)),
  get: contract('members:get', z.object({ id: z.string() }), memberDetailSchema.nullable()),
  create: contract('members:create', createMemberSchema, memberDetailSchema),
  update: contract(
    'members:update',
    z.object({ id: z.string(), patch: updateMemberSchema }),
    memberDetailSchema
  ),
  changeStatus: contract(
    'members:change-status',
    z.object({ id: z.string(), statusCode: z.string(), reason: z.string().trim().min(1).nullable() }),
    memberDetailSchema
  ),
  remove: contract('members:remove', z.object({ id: z.string() }), z.object({ ok: z.literal(true) })),
  exportExcel: contract(
    'members:export-excel',
    memberFiltersSchema,
    z.union([
      z.object({ saved: z.literal(true), path: z.string(), count: z.number() }),
      z.object({ saved: z.literal(false) })
    ])
  )
}
