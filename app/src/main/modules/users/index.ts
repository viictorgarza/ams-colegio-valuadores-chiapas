import { handle } from '@main/core/ipc/registry'
import { contracts } from '@shared/contracts'
import * as service from './users.service'

const actor = (): string | null => service.me()?.id ?? null

export function register(): void {
  handle(contracts.auth.login, ({ username, password }) => service.login(username, password))
  handle(contracts.auth.me, () => service.me())
  handle(contracts.auth.logout, () => {
    service.logout()
    return { ok: true as const }
  })
  handle(contracts.auth.changePassword, ({ currentPassword, newPassword }) =>
    service.changeOwnPassword(currentPassword, newPassword)
  )

  handle(contracts.users.list, () => service.listUsers())
  handle(contracts.users.create, (input) => service.createUser(input, actor()))
  handle(contracts.users.update, ({ id, fullName, username }) => service.updateUser(id, { fullName, username }, actor()))
  handle(contracts.users.resetPassword, ({ id, newPassword }) => service.adminResetPassword(id, newPassword, actor()))
  handle(contracts.users.setActive, ({ id, isActive }) => service.setUserActive(id, isActive, actor()))
}
