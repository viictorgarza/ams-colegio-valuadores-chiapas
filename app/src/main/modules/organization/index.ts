import { eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { handle } from '@main/core/ipc/registry'
import { contracts } from '@shared/contracts'
import type { Organization } from '@shared/contracts'
import { getDb } from '@main/core/db'
import * as s from '@main/core/db/schema'
import { bus } from '@main/core/events/bus'
import { me } from '../users/users.service'
import { mimeTypeFor, pickAndStoreFile, readStoredFileBase64, storedFilePath } from '../documents/documents.files'

const actor = (): string | null => me()?.id ?? null

function toOrganization(org: typeof s.organization.$inferSelect): Organization {
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
    website: org.website,
    hasLogo: org.logoFileId !== null
  }
}

function requireOrganization(): typeof s.organization.$inferSelect {
  const existing = getDb().select().from(s.organization).limit(1).get()
  if (!existing) throw new Error('No hay organización configurada.')
  return existing
}

export function register(): void {
  handle(contracts.organization.get, () => {
    const rows = getDb().select().from(s.organization).limit(1).all()
    const org = rows[0]
    return org ? toOrganization(org) : null
  })

  handle(contracts.organization.update, (patch) => {
    const db = getDb()
    const existing = requireOrganization()
    db.update(s.organization)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(s.organization.id, existing.id))
      .run()
    const updated = db.select().from(s.organization).where(eq(s.organization.id, existing.id)).get()!
    bus.emit('organization.updated', { actorId: actor(), name: updated.name })
    return toOrganization(updated)
  })

  handle(contracts.organization.uploadLogo, async () => {
    const picked = await pickAndStoreFile()
    if (!picked) return null

    const db = getDb()
    const existing = requireOrganization()
    let file = db.select().from(s.files).where(eq(s.files.sha256, picked.sha256)).get()
    if (!file) {
      const fileId = uuidv7()
      db.insert(s.files)
        .values({
          id: fileId,
          sha256: picked.sha256,
          sizeBytes: picked.sizeBytes,
          mimeType: mimeTypeFor(picked.originalName),
          originalName: picked.originalName,
          createdBy: actor()
        })
        .run()
      file = db.select().from(s.files).where(eq(s.files.id, fileId)).get()!
    }

    db.update(s.organization)
      .set({ logoFileId: file.id, updatedAt: new Date().toISOString() })
      .where(eq(s.organization.id, existing.id))
      .run()
    const updated = db.select().from(s.organization).where(eq(s.organization.id, existing.id)).get()!
    bus.emit('organization.updated', { actorId: actor(), name: updated.name })
    return toOrganization(updated)
  })

  handle(contracts.organization.getLogo, () => {
    const db = getDb()
    const org = db.select().from(s.organization).limit(1).get()
    if (!org?.logoFileId) return null
    const file = db.select().from(s.files).where(eq(s.files.id, org.logoFileId)).get()
    if (!file) return null
    const path = storedFilePath(file.sha256, file.originalName)
    return { mimeType: file.mimeType, dataBase64: readStoredFileBase64(path) }
  })

  handle(contracts.organization.removeLogo, () => {
    const db = getDb()
    const existing = requireOrganization()
    db.update(s.organization)
      .set({ logoFileId: null, updatedAt: new Date().toISOString() })
      .where(eq(s.organization.id, existing.id))
      .run()
    const updated = db.select().from(s.organization).where(eq(s.organization.id, existing.id)).get()!
    bus.emit('organization.updated', { actorId: actor(), name: updated.name })
    return toOrganization(updated)
  })
}
