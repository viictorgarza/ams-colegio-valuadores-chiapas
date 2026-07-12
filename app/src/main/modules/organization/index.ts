import { handle } from '@main/core/ipc/registry'
import { contracts } from '@shared/contracts'
import { getDb } from '@main/core/db'
import * as s from '@main/core/db/schema'

export function register(): void {
  handle(contracts.organization.get, () => {
    const rows = getDb().select().from(s.organization).limit(1).all()
    const org = rows[0]
    if (!org) return null
    return {
      id: org.id,
      name: org.name,
      shortName: org.shortName,
      rfc: org.rfc,
      street: org.street,
      city: org.city,
      state: org.state,
      zip: org.zip,
      country: org.country,
      phone: org.phone,
      email: org.email,
      website: org.website
    }
  })
}
