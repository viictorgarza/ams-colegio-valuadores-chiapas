import { eq } from 'drizzle-orm'
import { handle } from '@main/core/ipc/registry'
import { contracts } from '@shared/contracts'
import { getDb } from '@main/core/db'
import * as s from '@main/core/db/schema'
import { bus } from '@main/core/events/bus'
import { me } from '../users/users.service'

const actor = (): string | null => me()?.id ?? null

function toOrganization(org: typeof s.organization.$inferSelect): {
  id: string
  name: string
  shortName: string | null
  rfc: string | null
  street: string | null
  city: string | null
  state: string | null
  zip: string | null
  country: string | null
  phone: string | null
  email: string | null
  website: string | null
} {
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
}

export function register(): void {
  handle(contracts.organization.get, () => {
    const rows = getDb().select().from(s.organization).limit(1).all()
    const org = rows[0]
    return org ? toOrganization(org) : null
  })

  handle(contracts.organization.update, (patch) => {
    const db = getDb()
    const existing = db.select().from(s.organization).limit(1).get()
    if (!existing) throw new Error('No hay organización configurada.')
    db.update(s.organization)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(s.organization.id, existing.id))
      .run()
    const updated = db.select().from(s.organization).where(eq(s.organization.id, existing.id)).get()!
    bus.emit('organization.updated', { actorId: actor(), name: updated.name })
    return toOrganization(updated)
  })
}
