import { useState } from 'react'
import { faClock, faLocationDot, faNoteSticky, faPen, faTrash } from '@fortawesome/free-solid-svg-icons'
import type { CalendarEvent, CreateEventInput } from '@shared/contracts'
import { eventTypeLabels } from '@shared/contracts'
import { api } from '@renderer/api'
import { Button, Chip, Field, Icon, Modal, TextInput } from '@renderer/components/ui'

const EVENT_TYPES = Object.entries(eventTypeLabels) as Array<[CreateEventInput['eventType'], string]>

function dateLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(y!, m! - 1, d!)
  return date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

/** Detalle de un evento del calendario: lugar, fecha, horario y notas.
 * Se abre al hacer clic en un evento, sin importar desde dónde (dashboard,
 * cuadrícula o agenda). El modo edición (2026-07) es el respaldo a
 * "arrastrar para reprogramar" (MonthGrid), que no responde al tacto —
 * sin él, cambiar la fecha de un evento en una laptop táctil era imposible. */
export function EventDetailModal(props: {
  event: CalendarEvent
  onClose: () => void
  onChanged?: () => void
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [event, setEvent] = useState(props.event)

  if (editing) {
    return (
      <EditEventForm
        event={event}
        onClose={props.onClose}
        onCancel={() => setEditing(false)}
        onSaved={(updated) => {
          setEvent(updated)
          setEditing(false)
          props.onChanged?.()
        }}
        onDeleted={() => {
          props.onChanged?.()
          props.onClose()
        }}
      />
    )
  }

  const e = event
  return (
    <Modal
      title={e.title}
      subtitle={dateLabel(e.startsAt.slice(0, 10))}
      onClose={props.onClose}
      footer={
        <>
          <Button onClick={props.onClose}>Cerrar</Button>
          <Button variant="primary" icon={faPen} onClick={() => setEditing(true)}>
            Editar
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-2">
        <Chip tone="accent">{eventTypeLabels[e.eventType]}</Chip>
      </div>
      <div className="flex items-center gap-2 text-[13.5px] text-ink2">
        <Icon icon={faClock} className="w-3.5 h-3.5 text-ink3" />
        {timeLabel(e.startsAt)}
        {e.endsAt ? ` – ${timeLabel(e.endsAt)}` : ''}
      </div>
      {e.location && (
        <div className="flex items-center gap-2 text-[13.5px] text-ink2">
          <Icon icon={faLocationDot} className="w-3.5 h-3.5 text-ink3" />
          {e.location}
        </div>
      )}
      {e.notes && (
        <div className="flex items-start gap-2 text-[13.5px] text-ink2">
          <Icon icon={faNoteSticky} className="w-3.5 h-3.5 text-ink3 mt-0.5" />
          <p className="whitespace-pre-wrap">{e.notes}</p>
        </div>
      )}
    </Modal>
  )
}

function EditEventForm(props: {
  event: CalendarEvent
  onClose: () => void
  onCancel: () => void
  onSaved: (event: CalendarEvent) => void
  onDeleted: () => void
}): React.JSX.Element {
  const e = props.event
  const [title, setTitle] = useState(e.title)
  const [eventType, setEventType] = useState<CreateEventInput['eventType']>(e.eventType)
  const [date, setDate] = useState(e.startsAt.slice(0, 10))
  const [startTime, setStartTime] = useState(e.startsAt.slice(11, 16))
  const [endTime, setEndTime] = useState(e.endsAt ? e.endsAt.slice(11, 16) : '')
  const [location, setLocation] = useState(e.location ?? '')
  const [notes, setNotes] = useState(e.notes ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(): Promise<void> {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const updated = await api.events.update({
        id: e.id,
        patch: {
          title: title.trim(),
          eventType,
          startsAt: `${date}T${startTime}`,
          endsAt: endTime ? `${date}T${endTime}` : null,
          location: location.trim() || null,
          notes: notes.trim() || null
        }
      })
      props.onSaved(updated)
    } catch {
      setError('No se pudo guardar. Revisa el título y la fecha.')
      setBusy(false)
    }
  }

  async function remove(): Promise<void> {
    setBusy(true)
    await api.events.remove({ id: e.id })
    props.onDeleted()
  }

  return (
    <Modal
      title="Editar evento"
      onClose={props.onClose}
      footer={
        <>
          <Button variant="danger" icon={faTrash} disabled={busy} onClick={() => setConfirmingDelete(true)}>
            Eliminar
          </Button>
          <div className="flex-1" />
          <Button onClick={props.onCancel}>Cancelar</Button>
          <Button variant="primary" disabled={busy || !title.trim() || !date || !startTime} onClick={() => void save()}>
            Guardar
          </Button>
        </>
      }
    >
      <Field label="Título">
        <TextInput value={title} onChange={setTitle} autoFocus />
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
        <TextInput value={location} onChange={setLocation} />
      </Field>
      <Field label="Notas" hint="Opcional">
        <TextInput value={notes} onChange={setNotes} />
      </Field>

      {error && <p className="text-[13px] text-bad bg-bad-bg rounded-lg px-3 py-2">{error}</p>}

      {confirmingDelete && (
        <Modal
          title="Eliminar evento"
          subtitle="Esta acción no se puede deshacer."
          onClose={() => setConfirmingDelete(false)}
          footer={
            <>
              <Button onClick={() => setConfirmingDelete(false)}>Cancelar</Button>
              <Button variant="danger" icon={faTrash} onClick={() => void remove()}>
                Sí, eliminar
              </Button>
            </>
          }
        >
          <p className="text-[13.5px]">Se eliminará “{e.title}” del calendario.</p>
        </Modal>
      )}
    </Modal>
  )
}
