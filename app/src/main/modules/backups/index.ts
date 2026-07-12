import { handle } from '@main/core/ipc/registry'
import { contracts } from '@shared/contracts'
import * as service from './backups.service'
import { me } from '../users/users.service'

const actor = (): string | null => me()?.id ?? null

export function register(): void {
  handle(contracts.backups.create, () => service.createLocalBackup(actor()))
  handle(contracts.backups.restore, () => service.restoreFromLocalBackup())
  handle(contracts.backups.getLast, () => service.getLastBackup())
}
