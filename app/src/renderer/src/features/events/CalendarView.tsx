import { useEffect, useState } from 'react'
import {
  faCalendarPlus,
  faClock,
  faListUl,
  faLocationDot,
  faTableCells,
  faTrash
} from '@fortawesome/free-solid-svg-icons'
import type { CalendarEvent, CreateEventInput } from '@shared/contracts'
import { eventTypeLabels } from '@shared/contracts'
import { api } from '@renderer/api'
import { Button, Chip, Field, Icon, Modal, TextInput } from '@renderer/components/ui'
import { MonthGrid } from './MonthGrid'
import { EventDetailModal } from './EventDetailModal'

const EVENT_TYPES = Object.entries(eventTypeLabels) as Array<[CreateEventInput['eventType'], string]>

function dateLabel(day: string): string {
  // "YYYY-MM-DD" a mano: new Date("YYYY-MM-DD") lo interpreta como UTC y
  // puede mostrar el día anterior en zonas horarias negativas (México).
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(y!, m! - 1, d!)
  return date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/** "YYYY-MM-DD" en hora local — evitar toISOString() aquí (convierte a UTC). */
function todayLocal(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function timeLabel(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function groupByDate(events: CalendarEvent[]): Array<[string, CalendarEvent[]]> {
  const groups = new Map<string, CalendarEvent[]>()
  for (const e of events) {
    const day = e.startsAt.slice(0, 10)
    const list = groups.get(day) ?? []
    list.push(e)
    groups.set(day, list)
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
}

export function CalendarView(): React.JSX.Element {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [showNew, setShowNew] = useState(false)
  const [newDate, setNewDate] = useState<string | undefined>(undefined)
  const [mode, setMode] = useState<'cuadricula' | 'agenda'>('cuadricula')
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null)

  function reload(): void {
    void api.events.list().then(setEvents)
  }
  useEffect(reload, [])

  async function remove(id: string): Promise<void> {
    await api.events.remove({ id })
    reload()
  }

  async function reschedule(eventId: string, newDay: string): Promise<void> {
    const ev = events.find((e) => e.id === eventId)
    if (!ev) return
    const time = ev.startsAt.slice(10) // "THH:MM..."
    const patch: { startsAt: string; endsAt?: string | null } = { startsAt: `${newDay}${time}` }
    if (ev.endsAt) patch.endsAt = `${newDay}${ev.endsAt.slice(10)}`
    // Optimista: se ve el cambio de inmediato, sin esperar la vuelta del IPC.
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, ...patch } : e)))
    await api.events.update({ id: eventId, patch })
    reload()
  }

  const today = todayLocal()
  const upcoming = events.filter((e) => e.startsAt.slice(0, 10) >= today)
  const past = events.filter((e) => e.startsAt.slice(0, 10) < today)

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-start gap-3 mb-5">
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">Calendario</h1>
          <p className="text-[13px] text-ink3 mt-0.5">
            {upcoming.length} evento{upcoming.length === 1 ? '' : 's'} próximo{upcoming.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex gap-1 border border-line rounded-lg p-0.5">
          <button
            onClick={() => setMode('cuadricula')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] ${
              mode === 'cuadricula' ? 'bg-accent text-on-accent font-semibold' : 'text-ink2 hover:bg-inset'
            }`}
          >
            <Icon icon={faTableCells} className="w-3 h-3" />
            Cuadrícula
          </button>
          <button
            onClick={() => setMode('agenda')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] ${
              mode === 'agenda' ? 'bg-accent text-on-accent font-semibold' : 'text-ink2 hover:bg-inset'
            }`}
          >
            <Icon icon={faListUl} className="w-3 h-3" />
            Agenda
          </button>
        </div>
        <Button
          variant="primary"
          icon={faCalendarPlus}
          onClick={() => {
            setNewDate(undefined)
            setShowNew(true)
          }}
        >
          Nuevo Evento
        </Button>
      </div>

      {mode === 'cuadricula' && (
        <MonthGrid
          events={events}
          todayStr={today}
          onDayClick={(day) => {
            setNewDate(day)
            setShowNew(true)
          }}
          onEventDrop={(eventId, day) => void reschedule(eventId, day)}
          onEventClick={setDetailEvent}
        />
      )}

      {mode === 'agenda' && (
        <>
          {upcoming.length === 0 && past.length === 0 && (
            <div className="border border-line rounded-xl bg-surface p-8 text-center text-[13.5px] text-ink3">
              Sin eventos programados. Crea el primero con "Nuevo Evento".
            </div>
          )}

          <EventGroups groups={groupByDate(upcoming)} onDelete={(id) => void remove(id)} onOpen={setDetailEvent} />

          {past.length > 0 && (
            <div className="mt-8">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-ink3 mb-2">Pasados</h2>
              <div className="opacity-60">
                <EventGroups groups={groupByDate(past)} onDelete={(id) => void remove(id)} onOpen={setDetailEvent} />
              </div>
            </div>
          )}
        </>
      )}

      {showNew && (
        <NewEventModal
          initialDate={newDate}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false)
            reload()
          }}
        />
      )}

      {detailEvent && (
        <EventDetailModal event={detailEvent} onClose={() => setDetailEvent(null)} onChanged={reload} />
      )}
    </div>
  )
}

function EventGroups(props: {
  groups: Array<[string, CalendarEvent[]]>
  onDelete: (id: string) => void
  onOpen: (event: CalendarEvent) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      {props.groups.map(([day, items]) => (
        <div key={day}>
          <div className="text-[12.5px] font-semibold text-ink2 mb-1.5 capitalize">{dateLabel(day)}</div>
          <div className="border border-line rounded-xl bg-surface divide-y divide-line">
            {items.map((e) => (
              <div
                key={e.id}
                onClick={() => props.onOpen(e)}
                className="px-4 py-3 flex items-center gap-3 flex-wrap cursor-pointer hover:bg-inset"
              >
                <Chip tone="accent">{eventTypeLabels[e.eventType]}</Chip>
                <div className="flex-1 min-w-[160px]">
                  <div className="text-[14px] font-medium">{e.title}</div>
                  <div className="text-[12.5px] text-ink3 flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Icon icon={faClock} className="w-3 h-3" />
                      {timeLabel(e.startsAt)}
                      {e.endsAt ? ` – ${timeLabel(e.endsAt)}` : ''}
                    </span>
                    {e.location && (
                      <span className="flex items-center gap-1">
                        <Icon icon={faLocationDot} className="w-3 h-3" />
                        {e.location}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(ev) => {
                    ev.stopPropagation()
                    props.onDelete(e.id)
                  }}
                  title="Eliminar evento"
                  className="text-ink3 hover:text-bad p-1.5 rounded-lg hover:bg-bad-bg"
                >
                  <Icon icon={faTrash} className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function NewEventModal(props: {
  onClose: () => void
  onCreated: () => void
  initialDate?: string
}): React.JSX.Element {
  const [title, setTitle] = useState('')
  const [eventType, setEventType] = useState<CreateEventInput['eventType']>('reunion')
  const [date, setDate] = useState(props.initialDate ?? todayLocal())
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(): Promise<void> {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await api.events.create({
        title: title.trim(),
        eventType,
        startsAt: `${date}T${startTime}`,
        endsAt: endTime ? `${date}T${endTime}` : null,
        location: location.trim() || null,
        notes: notes.trim() || null
      })
      props.onCreated()
    } catch {
      setError('No se pudo crear el evento. Revisa el título y la fecha.')
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Nuevo evento"
      subtitle="Reuniones, asambleas, ponencias u otro tipo de evento"
      onClose={props.onClose}
      footer={
        <>
          <Button onClick={props.onClose}>Cancelar</Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy || !title.trim() || !date || !startTime}>
            Crear evento
          </Button>
        </>
      }
    >
      <Field label="Título">
        <TextInput value={title} onChange={setTitle} placeholder="Asamblea general ordinaria" autoFocus />
      </Field>

      <div className="flex flex-wrap gap-2">
        {EVENT_TYPES.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setEventType(key)}
            className={
              key === eventType
                ? 'px-3 py-1 rounded-full bg-accent text-on-accent text-[12.5px] font-semibold'
                : 'px-3 py-1 rounded-full border border-line text-ink2 text-[12.5px] hover:bg-inset'
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_100px_100px] gap-3">
        <Field label="Fecha">
          <TextInput type="date" value={date} onChange={setDate} />
        </Field>
        <Field label="Inicio">
          <TextInput type="time" value={startTime} onChange={setStartTime} />
        </Field>
        <Field label="Fin" hint="Opcional">
          <TextInput type="time" value={endTime} onChange={setEndTime} />
        </Field>
      </div>

      <Field label="Lugar" hint="Opcional">
        <TextInput value={location} onChange={setLocation} placeholder="Salón de usos múltiples" />
      </Field>
      <Field label="Notas" hint="Opcional">
        <TextInput value={notes} onChange={setNotes} placeholder="Orden del día, invitados, etc." />
      </Field>

      {error && <p className="text-[13px] text-bad bg-bad-bg rounded-lg px-3 py-2">{error}</p>}
    </Modal>
  )
}
