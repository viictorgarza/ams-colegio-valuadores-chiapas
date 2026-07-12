import { and, asc, eq, isNull } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { getDb } from '../../core/db'
import * as s from '../../core/db/schema'
import { bus } from '../../core/events/bus'
import type { CalendarEvent, CreateEventInput, UpdateEventInput } from '../../../shared/contracts'

export class EventError extends Error {}

function toEvent(row: typeof s.events.$inferSelect): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    eventType: row.eventType,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    location: row.location,
    notes: row.notes,
    createdAt: row.createdAt
  }
}

export function listEvents(): CalendarEvent[] {
  return getDb()
    .select()
    .from(s.events)
    .where(isNull(s.events.deletedAt))
    .orderBy(asc(s.events.startsAt))
    .all()
    .map(toEvent)
}

export function createEvent(input: CreateEventInput, actorId: string | null): CalendarEvent {
  const db = getDb()
  const id = uuidv7()
  db.insert(s.events)
    .values({
      id,
      title: input.title,
      eventType: input.eventType,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      location: input.location ?? null,
      notes: input.notes ?? null,
      createdBy: actorId
    })
    .run()

  const row = db.select().from(s.events).where(eq(s.events.id, id)).get()
  if (!row) throw new EventError('El evento no se pudo leer tras crearlo')
  const event = toEvent(row)
  bus.emit('calendar_event.created', { actorId, eventId: id, title: event.title })
  return event
}

export function updateEvent(id: string, patch: UpdateEventInput['patch'], actorId: string | null): CalendarEvent {
  const db = getDb()
  const before = db.select().from(s.events).where(and(eq(s.events.id, id), isNull(s.events.deletedAt))).get()
  if (!before) throw new EventError('El evento no existe o está en la papelera')

  db.update(s.events)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(s.events.id, id))
    .run()

  const row = db.select().from(s.events).where(eq(s.events.id, id)).get()
  if (!row) throw new EventError('El evento no se pudo leer tras actualizarlo')
  const event = toEvent(row)
  bus.emit('calendar_event.updated', { actorId, eventId: id, title: event.title })
  return event
}

export function removeEvent(id: string, actorId: string | null): void {
  const db = getDb()
  const row = db.select().from(s.events).where(and(eq(s.events.id, id), isNull(s.events.deletedAt))).get()
  if (!row) throw new EventError('El evento no existe o ya está en la papelera')
  db.update(s.events)
    .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(s.events.id, id))
    .run()
  bus.emit('calendar_event.deleted', { actorId, eventId: id, title: row.title })
}
