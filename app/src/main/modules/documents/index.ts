import { handle } from '@main/core/ipc/registry'
import { contracts } from '@shared/contracts'
import * as service from './documents.service'
import { me } from '../users/users.service'

const actor = (): string | null => me()?.id ?? null

export function register(): void {
  handle(contracts.documents.listByMember, ({ memberId }) => service.getMemberExpediente(memberId))

  handle(contracts.documents.upload, ({ memberId, documentTypeId }) =>
    service.uploadVersion(memberId, documentTypeId, actor())
  )

  handle(contracts.documents.uploadFromPath, ({ memberId, documentTypeId, filePath }) =>
    service.uploadVersionFromPath(memberId, documentTypeId, filePath, actor())
  )

  handle(contracts.documents.setStatus, ({ memberDocumentId, status }) =>
    service.setStatus(memberDocumentId, status, actor())
  )

  handle(contracts.documents.setExpiry, ({ memberDocumentId, expiresAt }) =>
    service.setExpiry(memberDocumentId, expiresAt, actor())
  )

  handle(contracts.documents.setIssuedAt, ({ memberDocumentId, issuedAt }) =>
    service.setIssuedAt(memberDocumentId, issuedAt, actor())
  )

  handle(contracts.documents.setNotes, ({ memberDocumentId, notes }) =>
    service.setNotes(memberDocumentId, notes, actor())
  )

  handle(contracts.documents.remove, ({ memberDocumentId }) => service.removeMemberDocument(memberDocumentId, actor()))

  handle(contracts.documents.setPhysical, ({ memberDocumentId, hasPhysical, physicalLocation }) =>
    service.setPhysical(memberDocumentId, hasPhysical, physicalLocation, actor())
  )

  handle(contracts.documents.openVersion, async ({ versionId }) => {
    await service.openVersion(versionId)
    return { ok: true as const }
  })

  handle(contracts.documents.downloadVersion, async ({ versionId }) => {
    const path = await service.downloadVersion(versionId)
    return path ? { saved: true as const, path } : { saved: false as const }
  })

  handle(contracts.documents.getVersionData, ({ versionId }) => service.getVersionData(versionId))

  handle(contracts.documents.getCredential, ({ memberId }) => service.getCredential(memberId))

  handle(contracts.documents.overview, () => service.listExpedienteOverview())

  handle(contracts.documents.exportAll, () => service.exportAllExpedientes(actor()))

  handle(contracts.documents.upcomingExpirations, ({ withinDays }) => service.upcomingExpirations(withinDays))

  handle(contracts.documents.listTypes, () => service.listDocumentTypes())

  handle(contracts.documents.createType, (input) => service.createDocumentType(input, actor()))

  handle(contracts.documents.updateType, ({ id, patch }) => service.updateDocumentType(id, patch, actor()))

  handle(contracts.documents.setTypeActive, ({ id, isActive }) => service.setDocumentTypeActive(id, isActive, actor()))

  handle(contracts.documents.getOcrStatus, () => ({ configured: service.isOcrConfigured() }))

  handle(contracts.documents.detectExpiry, ({ versionId }) => service.detectExpiry(versionId))
}
