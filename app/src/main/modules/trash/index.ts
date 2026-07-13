import { handle } from '@main/core/ipc/registry'
import { contracts } from '@shared/contracts'
import type { TrashItem, TrashType } from '@shared/contracts'
import * as membersService from '../members/members.service'
import * as paymentsService from '../payments/payments.service'
import * as eventsService from '../events/events.service'
import * as documentsService from '../documents/documents.service'
import * as assembliesService from '../assemblies/assemblies.service'
import { me } from '../users/users.service'

const actor = (): string | null => me()?.id ?? null

/**
 * Papelera universal (M4/E-08): agrega el borrado lógico que cada módulo ya
 * hacía por su cuenta (deleted_at) en una sola vista con restauración, sin
 * que ningún módulo conozca a los demás — solo este agregador los importa.
 */
export function register(): void {
  handle(contracts.trash.list, () => {
    const items: TrashItem[] = [
      ...membersService.listDeletedMembers().map((i) => ({ ...i, type: 'member' as const })),
      ...paymentsService.listDeletedPayments().map((i) => ({ ...i, type: 'payment' as const })),
      ...eventsService.listDeletedEvents().map((i) => ({ ...i, type: 'event' as const })),
      ...documentsService.listDeletedMemberDocuments().map((i) => ({ ...i, type: 'document' as const })),
      ...assembliesService.listDeletedAssemblies().map((i) => ({ ...i, type: 'assembly' as const }))
    ]
    return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
  })

  handle(contracts.trash.restore, ({ type, id }) => {
    const restoreFns: Record<TrashType, (id: string, actorId: string | null) => void> = {
      member: membersService.restoreMember,
      payment: paymentsService.restorePayment,
      event: eventsService.restoreEvent,
      document: documentsService.restoreMemberDocument,
      assembly: assembliesService.restoreAssembly
    }
    restoreFns[type](id, actor())
    return { ok: true as const }
  })
}
