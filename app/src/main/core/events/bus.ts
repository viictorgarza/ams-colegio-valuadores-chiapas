import { EventEmitter } from 'node:events'

/**
 * Eventos de dominio (docs/02 §4): los módulos se comunican por aquí, nunca
 * importando los internos de otro módulo. Agregar un módulo = suscribirse,
 * sin tocar a los emisores.
 */
export interface DomainEvents {
  'app.started': { appVersion: string }
  'auth.login': { username: string; userId: string | null; success: boolean }
  'auth.logout': { userId: string }
  'member.created': { actorId: string | null; memberId: string; after: Record<string, unknown> }
  'member.updated': {
    actorId: string | null
    memberId: string
    before: Record<string, unknown>
    after: Record<string, unknown>
  }
  'member.status_changed': {
    actorId: string | null
    memberId: string
    fromCode: string
    toCode: string
    reason: string | null
  }
  'member.deleted': { actorId: string | null; memberId: string; before: Record<string, unknown> }
  'members.exported': { actorId: string | null; count: number; path: string }
  'payment.created': { actorId: string | null; paymentId: string; memberId: string; after: Record<string, unknown> }
  'payment.deleted': { actorId: string | null; paymentId: string; memberId: string; before: Record<string, unknown> }
  'annual_fee.set': { actorId: string | null; year: number; amountCents: number }
  'document.uploaded': {
    actorId: string | null
    memberId: string
    memberDocumentId: string
    documentTypeName: string
  }
  'document.status_changed': {
    actorId: string | null
    memberId: string
    memberDocumentId: string
    fromStatus: string
    toStatus: string
  }
  'document.physical_changed': {
    actorId: string | null
    memberId: string
    memberDocumentId: string
    hasPhysical: boolean
  }
  'document.expiry_changed': {
    actorId: string | null
    memberId: string
    memberDocumentId: string
    fromExpiresAt: string | null
    toExpiresAt: string | null
  }
  'document.issued_at_changed': {
    actorId: string | null
    memberId: string
    memberDocumentId: string
    fromIssuedAt: string | null
    toIssuedAt: string | null
    autoExpiresAt: string | null
  }
  'document.notes_changed': { actorId: string | null; memberId: string; memberDocumentId: string }
  'document.deleted': {
    actorId: string | null
    memberId: string
    memberDocumentId: string
    documentTypeName: string
  }
  'document_type.created': { actorId: string | null; documentTypeId: string; name: string }
  'document_type.updated': { actorId: string | null; documentTypeId: string; name: string }
  'document_type.active_changed': {
    actorId: string | null
    documentTypeId: string
    name: string
    isActive: boolean
  }
  'backup.created': { actorId: string | null; path: string }
  'expedientes.exported': { actorId: string | null; memberCount: number; path: string }
  'calendar_event.created': { actorId: string | null; eventId: string; title: string }
  'calendar_event.updated': { actorId: string | null; eventId: string; title: string }
  'calendar_event.deleted': { actorId: string | null; eventId: string; title: string }
  'assembly.created': { actorId: string | null; assemblyId: string; date: string }
  'assembly.deleted': { actorId: string | null; assemblyId: string; date: string }
  'assembly.attendance_changed': {
    actorId: string | null
    assemblyId: string
    memberId: string
    present: boolean
  }
  'organization.updated': { actorId: string | null; name: string }
  'user.created': { actorId: string | null; userId: string; username: string; role: string }
  'user.active_changed': { actorId: string | null; userId: string; username: string; isActive: boolean }
  'user.password_changed': { actorId: string | null; userId: string; username: string }
  'user.updated': { actorId: string | null; userId: string; fullName: string; username: string }
  'user.password_reset': { actorId: string | null; userId: string; username: string }
  'first_run.completed': { actorId: string | null }
  'member.restored': { actorId: string | null; memberId: string }
  'payment.restored': { actorId: string | null; paymentId: string; memberId: string }
  'calendar_event.restored': { actorId: string | null; eventId: string; title: string }
  'assembly.restored': { actorId: string | null; assemblyId: string; date: string }
  'document.restored': { actorId: string | null; memberId: string; memberDocumentId: string }
}

class TypedBus {
  private readonly emitter = new EventEmitter()

  emit<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): void {
    this.emitter.emit(event, payload)
  }

  on<K extends keyof DomainEvents>(event: K, listener: (payload: DomainEvents[K]) => void): void {
    this.emitter.on(event, listener as (...args: unknown[]) => void)
  }
}

export const bus = new TypedBus()
