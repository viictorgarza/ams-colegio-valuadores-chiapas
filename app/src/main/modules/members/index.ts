import { handle } from '@main/core/ipc/registry'
import { contracts } from '@shared/contracts'
import * as service from './members.service'
import { exportMembersToExcel } from './members.excel'
import { me } from '../users/users.service'

const actor = (): string | null => me()?.id ?? null

export function register(): void {
  handle(contracts.members.list, (filters) => service.listMembers(filters))
  handle(contracts.members.get, ({ id }) => service.getMember(id))
  handle(contracts.members.create, (input) => service.createMember(input, actor()))
  handle(contracts.members.update, ({ id, patch }) => service.updateMember(id, patch, actor()))
  handle(contracts.members.changeStatus, ({ id, statusCode, reason }) =>
    service.changeStatus(id, statusCode, reason, actor())
  )
  handle(contracts.members.remove, ({ id }) => {
    service.softDeleteMember(id, actor())
    return { ok: true as const }
  })
  handle(contracts.members.exportExcel, (filters) => exportMembersToExcel(filters, actor()))
}
