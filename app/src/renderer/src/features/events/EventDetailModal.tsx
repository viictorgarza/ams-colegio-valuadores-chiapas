import { faClock, faLocationDot, faNoteSticky } from '@fortawesome/free-solid-svg-icons'
import type { CalendarEvent } from '@shared/contracts'
import { eventTypeLabels } from '@shared/contracts'
import { Button, Chip, Icon, Modal } from '@renderer/components/ui'

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
 * cuadrícula o agenda). */
export function EventDetailModal(props: { event: CalendarEvent; onClose: () => void }): React.JSX.Element {
  const e = props.event
  return (
    <Modal title={e.title} subtitle={dateLabel(e.startsAt.slice(0, 10))} onClose={props.onClose} footer={<Button onClick={props.onClose}>Cerrar</Button>}>
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
