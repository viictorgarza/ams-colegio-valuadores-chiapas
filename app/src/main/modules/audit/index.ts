import { hostname } from 'node:os'
import { v7 as uuidv7 } from 'uuid'
// Imports relativos a propósito: este módulo también se ejecuta fuera del bundle
// de Electron (scripts/smoke.ts con tsx), donde los alias no existen.
import { getDb } from '../../core/db'
import * as s from '../../core/db/schema'
import { bus } from '../../core/events/bus'

/**
 * Auditoría (docs/02 §4): nadie la invoca — se suscribe a los eventos de dominio
 * y registra en una tabla append-only. Agregar módulos nuevos no la modifica;
 * basta con que emitan sus eventos.
 */
export function register(): void {
  const device = hostname()

  bus.on('auth.login', (e) => {
    write({
      userId: e.userId,
      action: e.success ? 'auth.login' : 'auth.login_fallido',
      afterJson: JSON.stringify({ username: e.username }),
      device
    })
  })

  bus.on('auth.logout', (e) => {
    write({ userId: e.userId, action: 'auth.logout', device })
  })

  bus.on('app.started', (e) => {
    write({ userId: null, action: 'app.inicio', afterJson: JSON.stringify({ version: e.appVersion }), device })
  })

  bus.on('member.created', (e) => {
    write({
      userId: e.actorId,
      action: 'miembro.alta',
      entityType: 'member',
      entityId: e.memberId,
      afterJson: JSON.stringify(e.after),
      device
    })
  })

  bus.on('member.updated', (e) => {
    write({
      userId: e.actorId,
      action: 'miembro.edicion',
      entityType: 'member',
      entityId: e.memberId,
      beforeJson: JSON.stringify(e.before),
      afterJson: JSON.stringify(e.after),
      device
    })
  })

  bus.on('member.status_changed', (e) => {
    write({
      userId: e.actorId,
      action: 'miembro.cambio_estado',
      entityType: 'member',
      entityId: e.memberId,
      beforeJson: JSON.stringify({ estado: e.fromCode }),
      afterJson: JSON.stringify({ estado: e.toCode, motivo: e.reason }),
      device
    })
  })

  bus.on('member.deleted', (e) => {
    write({
      userId: e.actorId,
      action: 'miembro.papelera',
      entityType: 'member',
      entityId: e.memberId,
      beforeJson: JSON.stringify(e.before),
      device
    })
  })

  bus.on('members.exported', (e) => {
    write({
      userId: e.actorId,
      action: 'miembros.exportacion',
      afterJson: JSON.stringify({ registros: e.count, archivo: e.path }),
      device
    })
  })

  bus.on('payment.created', (e) => {
    write({
      userId: e.actorId,
      action: 'pago.alta',
      entityType: 'payment',
      entityId: e.paymentId,
      afterJson: JSON.stringify(e.after),
      device
    })
  })

  bus.on('payment.deleted', (e) => {
    write({
      userId: e.actorId,
      action: 'pago.papelera',
      entityType: 'payment',
      entityId: e.paymentId,
      beforeJson: JSON.stringify(e.before),
      device
    })
  })

  bus.on('annual_fee.set', (e) => {
    write({
      userId: e.actorId,
      action: 'cuota.configuracion',
      afterJson: JSON.stringify({ year: e.year, amountCents: e.amountCents }),
      device
    })
  })

  bus.on('document.uploaded', (e) => {
    write({
      userId: e.actorId,
      action: 'expediente.subida',
      entityType: 'member_document',
      entityId: e.memberDocumentId,
      afterJson: JSON.stringify({ memberId: e.memberId, tipo: e.documentTypeName }),
      device
    })
  })

  bus.on('document.status_changed', (e) => {
    write({
      userId: e.actorId,
      action: 'expediente.cambio_estado',
      entityType: 'member_document',
      entityId: e.memberDocumentId,
      beforeJson: JSON.stringify({ estado: e.fromStatus }),
      afterJson: JSON.stringify({ estado: e.toStatus }),
      device
    })
  })

  bus.on('document.physical_changed', (e) => {
    write({
      userId: e.actorId,
      action: 'expediente.fisico',
      entityType: 'member_document',
      entityId: e.memberDocumentId,
      afterJson: JSON.stringify({ tieneFisico: e.hasPhysical }),
      device
    })
  })

  bus.on('document.expiry_changed', (e) => {
    write({
      userId: e.actorId,
      action: 'expediente.vencimiento',
      entityType: 'member_document',
      entityId: e.memberDocumentId,
      beforeJson: JSON.stringify({ expiresAt: e.fromExpiresAt }),
      afterJson: JSON.stringify({ expiresAt: e.toExpiresAt }),
      device
    })
  })

  bus.on('document.issued_at_changed', (e) => {
    write({
      userId: e.actorId,
      action: 'expediente.fecha_emision',
      entityType: 'member_document',
      entityId: e.memberDocumentId,
      beforeJson: JSON.stringify({ issuedAt: e.fromIssuedAt }),
      afterJson: JSON.stringify({ issuedAt: e.toIssuedAt, autoExpiresAt: e.autoExpiresAt }),
      device
    })
  })

  bus.on('ocr.api_key_changed', (e) => {
    write({
      userId: e.actorId,
      action: 'ocr.configuracion',
      entityType: 'settings',
      entityId: 'google_vision_api_key',
      afterJson: JSON.stringify({ configured: e.configured }),
      device
    })
  })

  bus.on('document.notes_changed', (e) => {
    write({
      userId: e.actorId,
      action: 'expediente.notas',
      entityType: 'member_document',
      entityId: e.memberDocumentId,
      device
    })
  })

  bus.on('document.deleted', (e) => {
    write({
      userId: e.actorId,
      action: 'expediente.papelera',
      entityType: 'member_document',
      entityId: e.memberDocumentId,
      beforeJson: JSON.stringify({ memberId: e.memberId, tipo: e.documentTypeName }),
      device
    })
  })

  bus.on('document_type.created', (e) => {
    write({
      userId: e.actorId,
      action: 'tipo_documento.alta',
      entityType: 'document_type',
      entityId: e.documentTypeId,
      afterJson: JSON.stringify({ nombre: e.name }),
      device
    })
  })

  bus.on('document_type.updated', (e) => {
    write({
      userId: e.actorId,
      action: 'tipo_documento.edicion',
      entityType: 'document_type',
      entityId: e.documentTypeId,
      afterJson: JSON.stringify({ nombre: e.name }),
      device
    })
  })

  bus.on('backup.created', (e) => {
    write({
      userId: e.actorId,
      action: 'respaldo.creado',
      afterJson: JSON.stringify({ archivo: e.path }),
      device
    })
  })

  bus.on('expedientes.exported', (e) => {
    write({
      userId: e.actorId,
      action: 'expedientes.exportacion',
      afterJson: JSON.stringify({ miembros: e.memberCount, carpeta: e.path }),
      device
    })
  })

  bus.on('calendar_event.created', (e) => {
    write({
      userId: e.actorId,
      action: 'evento.alta',
      entityType: 'event',
      entityId: e.eventId,
      afterJson: JSON.stringify({ titulo: e.title }),
      device
    })
  })

  bus.on('calendar_event.updated', (e) => {
    write({
      userId: e.actorId,
      action: 'evento.edicion',
      entityType: 'event',
      entityId: e.eventId,
      afterJson: JSON.stringify({ titulo: e.title }),
      device
    })
  })

  bus.on('calendar_event.deleted', (e) => {
    write({
      userId: e.actorId,
      action: 'evento.papelera',
      entityType: 'event',
      entityId: e.eventId,
      beforeJson: JSON.stringify({ titulo: e.title }),
      device
    })
  })

  bus.on('assembly.created', (e) => {
    write({
      userId: e.actorId,
      action: 'asamblea.alta',
      entityType: 'assembly',
      entityId: e.assemblyId,
      afterJson: JSON.stringify({ fecha: e.date }),
      device
    })
  })

  bus.on('assembly.deleted', (e) => {
    write({
      userId: e.actorId,
      action: 'asamblea.papelera',
      entityType: 'assembly',
      entityId: e.assemblyId,
      beforeJson: JSON.stringify({ fecha: e.date }),
      device
    })
  })

  bus.on('assembly.attendance_changed', (e) => {
    write({
      userId: e.actorId,
      action: 'asamblea.asistencia',
      entityType: 'attendance_record',
      entityId: `${e.assemblyId}:${e.memberId}`,
      afterJson: JSON.stringify({ present: e.present }),
      device
    })
  })

  bus.on('document_type.active_changed', (e) => {
    write({
      userId: e.actorId,
      action: 'tipo_documento.activacion',
      entityType: 'document_type',
      entityId: e.documentTypeId,
      afterJson: JSON.stringify({ nombre: e.name, activo: e.isActive }),
      device
    })
  })

  bus.on('organization.updated', (e) => {
    write({
      userId: e.actorId,
      action: 'organizacion.edicion',
      afterJson: JSON.stringify({ nombre: e.name }),
      device
    })
  })

  bus.on('user.created', (e) => {
    write({
      userId: e.actorId,
      action: 'usuario.alta',
      entityType: 'user',
      entityId: e.userId,
      afterJson: JSON.stringify({ username: e.username, rol: e.role }),
      device
    })
  })

  bus.on('user.active_changed', (e) => {
    write({
      userId: e.actorId,
      action: 'usuario.activacion',
      entityType: 'user',
      entityId: e.userId,
      afterJson: JSON.stringify({ username: e.username, activo: e.isActive }),
      device
    })
  })

  bus.on('user.password_changed', (e) => {
    write({
      userId: e.actorId,
      action: 'usuario.cambio_contrasena',
      entityType: 'user',
      entityId: e.userId,
      afterJson: JSON.stringify({ username: e.username }),
      device
    })
  })

  bus.on('first_run.completed', (e) => {
    write({ userId: e.actorId, action: 'sistema.primera_ejecucion_completada', device })
  })

  bus.on('member.restored', (e) => {
    write({ userId: e.actorId, action: 'miembro.restaurado', entityType: 'member', entityId: e.memberId, device })
  })

  bus.on('payment.restored', (e) => {
    write({ userId: e.actorId, action: 'pago.restaurado', entityType: 'payment', entityId: e.paymentId, device })
  })

  bus.on('calendar_event.restored', (e) => {
    write({
      userId: e.actorId,
      action: 'evento.restaurado',
      entityType: 'event',
      entityId: e.eventId,
      afterJson: JSON.stringify({ titulo: e.title }),
      device
    })
  })

  bus.on('assembly.restored', (e) => {
    write({
      userId: e.actorId,
      action: 'asamblea.restaurada',
      entityType: 'assembly',
      entityId: e.assemblyId,
      afterJson: JSON.stringify({ fecha: e.date }),
      device
    })
  })

  bus.on('document.restored', (e) => {
    write({
      userId: e.actorId,
      action: 'expediente.restaurado',
      entityType: 'member_document',
      entityId: e.memberDocumentId,
      device
    })
  })
}

function write(entry: {
  userId: string | null
  action: string
  entityType?: string
  entityId?: string
  beforeJson?: string
  afterJson?: string
  device: string
}): void {
  getDb()
    .insert(s.auditLog)
    .values({
      id: uuidv7(),
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      beforeJson: entry.beforeJson,
      afterJson: entry.afterJson,
      device: entry.device
    })
    .run()
}
