import { z } from 'zod'
import { contract } from './core'

export const catalogsContracts = {
  memberStatuses: contract(
    'catalogs:member-statuses',
    z.void(),
    z.array(z.object({ code: z.string(), name: z.string() }))
  ),
  membershipTypes: contract(
    'catalogs:membership-types',
    z.void(),
    z.array(z.object({ id: z.string(), name: z.string() }))
  ),
  lookupZip: contract(
    'catalogs:lookup-zip',
    z.object({ zip: z.string().trim().regex(/^\d{5}$/) }),
    z.object({ city: z.string().nullable(), state: z.string().nullable() }).nullable()
  )
}
