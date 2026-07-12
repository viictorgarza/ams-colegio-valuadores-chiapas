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

export const organizationContracts = {
  get: contract('organization:get', z.void(), organizationSchema.nullable())
}
