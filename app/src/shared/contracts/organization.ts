import { z } from 'zod'
import { contract } from './core'

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string().nullable(),
  rfc: z.string().nullable(),
  street: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  country: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable()
})

export type Organization = z.output<typeof organizationSchema>

const optionalText = z.string().trim().min(1).nullable()

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  shortName: optionalText,
  rfc: optionalText,
  street: optionalText,
  city: optionalText,
  state: optionalText,
  zip: optionalText,
  country: optionalText,
  phone: optionalText,
  email: z.string().trim().email('Correo inválido').nullable(),
  website: optionalText
})
export type UpdateOrganizationInput = z.output<typeof updateOrganizationSchema>

export const organizationContracts = {
  get: contract('organization:get', z.void(), organizationSchema.nullable()),
  update: contract('organization:update', updateOrganizationSchema, organizationSchema)
}
