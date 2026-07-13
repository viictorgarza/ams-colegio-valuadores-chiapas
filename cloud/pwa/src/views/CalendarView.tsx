import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import type { CalendarEvent, EventType } from '../types'
import { eventTypeLabels, formatDate, formatTime, parseLocalDate } from '../types'
import { useToast } from '../toast'
import { Button, Card, EmptyState, Field, Modal, Select, Spinner, TextArea, TextInput } from '../ui'

const TYPE_DOT: Record<EventType, string> = {
  reunion: 'bg-accent',
  asamblea: 'bg-good',
  ponencia: 'bg-warn',
  otro: 'bg-ink3'
}

export function CalendarView() {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null)
  const [editing, setEditing] = useState<CalendarEvent | 'new' | null>(null)
  const toast = useToast()

  const load = (): void => {
    api.events
      .list()
      .then(setEvents)
      .catch((e: Error) => toast(e.message, 'bad'))
  }

  useEffect(load, [])

  const { upcoming, past } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const up: CalendarEvent[] = []
    const pa: CalendarEvent[] = []
    for (const e of events ?? []) {
      if (parseLocalDate(e.startsAt) >= today) up.push(e)
      else pa.push(e)
    }
    pa.reverse()
    return { upcoming: up, past: pa }
  }, [events])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Calendario</h1>
        <Button onClick={() => setEditing('new')}>+ Nuevo evento</Button>
      </div>

      {events === null ? (
        <Spinner />
      ) : (
        <>
          <h2 className="mb-3 text-lg font-semibold">Próximos</h2>
          {upcoming.length === 0 ? (
            <EmptyState>No hay eventos próximos.</EmptyState>
          ) : (
            <EventList events={upcoming} onOpen={setEditing} />
          )}
          {past.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-lg font-semibold text-ink2">Pasados</h2>
              <EventList events={past} onOpen={setEditing} />
            </>
          )}
        </>
      )}

      {editing && (
        <EventModal
          event={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onChanged={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function EventList({ events, onOpen }: { events: CalendarEvent[]; onOpen: (e: CalendarEvent) => void }) {
  return (
    <div className="space-y-2">
      {events.map((e) => (
        <Card key={e.id} onClick={() => onOpen(e)}>
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 shrink-0 rounded-full ${TYPE_DOT[e.eventType]}`} />
            <div className="min-w-0">
              <p className="truncate font-medium">{e.title}</p>
              <p className="text-sm text-ink3">
                {formatDate(e.startsAt)}
                {formatTime(e.startsAt) && ` · ${formatTime(e.startsAt)}`}
                {e.location && ` · ${e.location}`} · {eventTypeLabels[e.eventType]}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

/** Alta y edición en el mismo modal — la edición de fecha/hora aquí es la vía
 * táctil (en el escritorio el drag del MonthGrid no responde al tacto). */
function EventModal({
  event,
  onClose,
  onChanged
}: {
  event: CalendarEvent | null
  onClose: () => void
  onChanged: () => void
}) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [eventType, setEventType] = useState<EventType>(event?.eventType ?? 'reunion')
  const [date, setDate] = useState(event ? event.startsAt.slice(0, 10) : new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState(event?.startsAt.includes('T') ? event.startsAt.slice(11, 16) : '18:00')
  const [location, setLocation] = useState(event?.location ?? '')
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const toast = useToast()

  const submit = async (): Promise<void> => {
    setBusy(true)
    const payload = {
      title: title.trim(),
      eventType,
      startsAt: `${date}T${time}`,
      location: location.trim() || null,
      notes: notes.trim() || null
    }
    try {
      if (event) {
        await api.events.update(event.id, payload)
        toast('Evento actualizado')
      } else {
        await api.events.create(payload)
        toast('Evento creado')
      }
      onChanged()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'bad')
      setBusy(false)
    }
  }

  const remove = async (): Promise<void> => {
    if (!event) return
    setBusy(true)
    try {
      await api.events.remove(event.id)
      toast('Evento enviado a papelera')
      onChanged()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo eliminar', 'bad')
      setBusy(false)
    }
  }

  return (
    <Modal title={event ? 'Editar evento' : 'Nuevo evento'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Título">
          <TextInput value={title} onChange={setTitle} autoFocus={!event} />
        </Field>
        <Field label="Tipo">
          <Select
            value={eventType}
            onChange={(v) => setEventType(v as EventType)}
            options={Object.entries(eventTypeLabels).map(([value, label]) => ({ value, label }))}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha">
            <TextInput value={date} onChange={setDate} type="date" />
          </Field>
          <Field label="Hora">
            <TextInput value={time} onChange={setTime} type="time" />
          </Field>
        </div>
        <Field label="Lugar (opcional)">
          <TextInput value={location} onChange={setLocation} />
        </Field>
        <Field label="Notas (opcional)">
          <TextArea value={notes} onChange={setNotes} />
        </Field>
        <Button onClick={() => void submit()} disabled={busy || !title.trim() || !date} full>
          {busy ? 'Guardando…' : event ? 'Guardar cambios' : 'Crear evento'}
        </Button>
        {event &&
          (confirmDelete ? (
            <Button variant="danger" onClick={() => void remove()} disabled={busy} full>
              Confirmar: enviar a papelera
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)} disabled={busy} full>
              Eliminar evento
            </Button>
          ))}
      </div>
    </Modal>
  )
}
