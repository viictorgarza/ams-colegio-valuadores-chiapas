import { z } from 'zod'
import { contract } from './core'

export const eventTypeSchema = z.enum(['reunion', 'asamblea', 'ponencia', 'otro'])

export const eventTypeLabels: Record<z.output<typeof eventTypeSchema>, string> = {
  reunion: 'Reunión',
  asamblea: 'Asamblea',
  ponencia: 'Ponencia',
  otro: 'Otro'
}

export const eventSchema = z.object({
  id: z.string(),
  title: z.string(),
  eventType: eventTypeSchema,
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string()
})
export type CalendarEvent = z.output<typeof eventSchema>

export const createEventSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio'),
  eventType: eventTypeSchema,
  startsAt: z.string().min(1, 'La fecha y hora son obligatorias'),
  endsAt: z.string().trim().min(1).nullable().optional(),
  location: z.string().trim().min(1).nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional()
})
export type CreateEventInput = z.output<typeof createEventSchema>

export const updateEventSchema = z.object({
  id: z.string(),
  patch: createEventSchema.partial()
})
export type UpdateEventInput = z.output<typeof updateEventSchema>

export const eventsContracts = {
  list: contract('events:list', z.void(), z.array(eventSchema)),
  create: contract('events:create', createEventSchema, eventSchema),
  update: contract('events:update', updateEventSchema, eventSchema),
  remove: contract('events:remove', z.object({ id: z.string() }), z.object({ ok: z.boolean() }))
}
