import { asc, eq } from 'drizzle-orm'
import { handle } from '@main/core/ipc/registry'
import { contracts } from '@shared/contracts'
import { getDb } from '@main/core/db'
import * as s from '@main/core/db/schema'

export function register(): void {
  handle(contracts.catalogs.memberStatuses, () =>
    getDb()
      .select({ code: s.memberStatuses.code, name: s.memberStatuses.name })
      .from(s.memberStatuses)
      .where(eq(s.memberStatuses.isActive, true))
      .orderBy(asc(s.memberStatuses.sortOrder))
      .all()
  )
  handle(contracts.catalogs.membershipTypes, () =>
    getDb()
      .select({ id: s.membershipTypes.id, name: s.membershipTypes.name })
      .from(s.membershipTypes)
      .where(eq(s.membershipTypes.isActive, true))
      .orderBy(asc(s.membershipTypes.sortOrder))
      .all()
  )
  handle(contracts.catalogs.lookupZip, ({ zip }) => lookupZip(zip))
}

/**
 * Autocompletado de ciudad/estado por CP (docs de la oficina sin internet:
 * si no hay conexión simplemente no autocompleta, la usuaria captura a mano).
 * API pública zippopotam.us sin llave — sin datos personales en la URL, solo
 * el código postal. (El servicio SEPOMEX/Icalia usado antes dejó de responder.)
 */
async function lookupZip(zip: string): Promise<{ city: string | null; state: string | null } | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(`https://api.zippopotam.us/mx/${zip}`, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return null
    const data = (await res.json()) as { places?: Array<{ 'place name'?: string; state?: string }> }
    const first = data.places?.[0]
    if (!first) return null
    return { city: first['place name'] ?? null, state: first.state ?? null }
  } catch {
    return null
  }
}
