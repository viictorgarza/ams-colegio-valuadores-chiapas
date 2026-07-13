import { handle } from '@main/core/ipc/registry'
import { contracts } from '@shared/contracts'
import { getDb } from '@main/core/db'
import * as s from '@main/core/db/schema'
import * as service from './backups.service'
import { generateRecoveryKit } from './backups.pdf'
import { me } from '../users/users.service'

const actor = (): string | null => me()?.id ?? null

export function register(): void {
  handle(contracts.backups.create, () => service.createLocalBackup(actor()))
  handle(contracts.backups.restore, () => service.restoreFromLocalBackup())
  handle(contracts.backups.getLast, () => service.getLastBackup())
  handle(contracts.backups.getCloudConfig, () => service.getCloudConfig())
  handle(contracts.backups.testCloudConnection, () => service.testCloudConnection())
  handle(contracts.backups.createCloudBackup, () => service.createCloudBackup(actor()))
  handle(contracts.backups.getLastCloudBackup, () => service.getLastCloudBackup())
  handle(contracts.backups.generateRecoveryKit, async () => {
    const org = getDb().select({ name: s.organization.name }).from(s.organization).limit(1).get()
    const path = await generateRecoveryKit(org?.name ?? 'AMS', service.getCloudConfig(), service.dataDir())
    return { saved: path !== null, path }
  })

  // Respaldo a la nube en cada apertura (Victor, 2026-07-13). Silencioso:
  // primer intento a los 15s; si falla (sin internet), reintenta cada 10 min
  // hasta lograr un respaldo exitoso en esta sesión.
  const RETRY_MS = 10 * 60_000
  const attemptCloudBackup = async (): Promise<void> => {
    const done = await service.runStartupCloudBackup()
    if (!done) setTimeout(() => void attemptCloudBackup(), RETRY_MS)
  }
  setTimeout(() => void attemptCloudBackup(), 15_000)
}
