import { authContracts } from './auth'
import { organizationContracts } from './organization'
import { systemContracts } from './system'
import { membersContracts } from './members'
import { catalogsContracts } from './catalogs'
import { paymentsContracts } from './payments'
import { documentsContracts } from './documents'
import { backupsContracts } from './backups'
import { eventsContracts } from './events'
import { assembliesContracts } from './assemblies'
import type { Contract } from './core'

export const contracts = {
  auth: authContracts,
  organization: organizationContracts,
  system: systemContracts,
  members: membersContracts,
  catalogs: catalogsContracts,
  payments: paymentsContracts,
  documents: documentsContracts,
  backups: backupsContracts,
  events: eventsContracts,
  assemblies: assembliesContracts
}

/** Lista plana de canales permitidos — el preload solo deja pasar estos. */
export function allowedChannels(): Set<string> {
  const set = new Set<string>()
  for (const group of Object.values(contracts)) {
    for (const c of Object.values(group) as Contract[]) {
      set.add(c.channel)
    }
  }
  return set
}

export * from './core'
export * from './auth'
export * from './organization'
export * from './system'
export * from './members'
export * from './catalogs'
export * from './payments'
export * from './documents'
export * from './backups'
export * from './events'
export * from './assemblies'
