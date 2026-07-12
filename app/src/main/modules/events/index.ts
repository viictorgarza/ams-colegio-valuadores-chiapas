import { handle } from '@main/core/ipc/registry'
import { contracts } from '@shared/contracts'
import * as service from './events.service'
import { me } from '../users/users.service'

const actor = (): string | null => me()?.id ?? null

export function register(): void {
  handle(contracts.events.list, () => service.listEvents())
  handle(contracts.events.create, (input) => service.createEvent(input, actor()))
  handle(contracts.events.update, ({ id, patch }) => service.updateEvent(id, patch, actor()))
  handle(contracts.events.remove, ({ id }) => {
    service.removeEvent(id, actor())
    return { ok: true }
  })
}
