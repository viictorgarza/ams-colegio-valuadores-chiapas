import { handle } from '@main/core/ipc/registry'
import { contracts } from '@shared/contracts'
import * as service from './users.service'

export function register(): void {
  handle(contracts.auth.login, ({ username, password }) => service.login(username, password))
  handle(contracts.auth.me, () => service.me())
  handle(contracts.auth.logout, () => {
    service.logout()
    return { ok: true as const }
  })
}
