import { useState } from 'react'
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import type { CalendarEvent } from '@shared/contracts'
import { eventTypeLabels } from '@shared/contracts'
import { Icon } from '@renderer/components/ui'

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const TYPE_DOT: Record<CalendarEvent['eventType'], string> = {
  reunion: 'bg-accent',
  asamblea: 'bg-warn',
  ponencia: 'bg-good',
  otro: 'bg-ink3'
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`
}

/** Celdas del mes visible, incluyendo días de relleno de meses vecinos. */
function buildCells(year: number, month: number): Array<{ date: string; inMonth: boolean }> {
  const first = new Date(year, month, 1)
  const startOffset = first.getDay() // 0=domingo
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const cells: Array<{ date: string; inMonth: boolean }> = []
  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({ date: toDateStr(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, daysInPrevMonth - i), inMonth: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: toDateStr(year, month, d), inMonth: true })
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = cells[cells.length - 1]!
    const [y, m, d] = last.date.split('-').map(Number)
    const next = new Date(y!, m! - 1, d! + 1)
    cells.push({ date: toDateStr(next.getFullYear(), next.getMonth(), next.getDate()), inMonth: false })
    if (cells.length >= 42) break
  }
  return cells
}

export function MonthGrid(props: {
  events: CalendarEvent[]
  compact?: boolean
  todayStr: string
  onDayClick?: (day: string) => void
  onEventDrop?: (eventId: string, day: string) => void
  onEventClick?: (event: CalendarEvent) => void
}): React.JSX.Element {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [dragOverDay, setDragOverDay] = useState<string | null>(null)

  const cells = buildCells(year, month)
  const eventsByDay = new Map<string, CalendarEvent[]>()
  for (const e of props.events) {
    const day = e.startsAt.slice(0, 10)
    const list = eventsByDay.get(day) ?? []
    list.push(e)
    eventsByDay.set(day, list)
  }

  function shiftMonth(delta: number): void {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  const monthLabel = new Date(year, month, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  const maxPerDay = props.compact ? 1 : 3

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold capitalize">{monthLabel}</span>
        <div className="flex gap-1">
          <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded-lg hover:bg-inset text-ink2">
            <Icon icon={faChevronLeft} className="w-3 h-3" />
          </button>
          <button onClick={() => shiftMonth(1)} className="p-1.5 rounded-lg hover:bg-inset text-ink2">
            <Icon icon={faChevronRight} className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-line border border-line rounded-xl overflow-hidden">
        {WEEKDAYS.map((w) => (
          <div key={w} className="bg-inset text-center text-[10.5px] font-semibold uppercase tracking-wide text-ink3 py-1.5">
            {w}
          </div>
        ))}
        {cells.map((cell) => {
          const dayEvents = eventsByDay.get(cell.date) ?? []
          const dayNum = Number(cell.date.slice(8, 10))
          const isToday = cell.date === props.todayStr
          return (
            <div
              key={cell.date}
              onClick={() => cell.inMonth && props.onDayClick?.(cell.date)}
              onDragOver={(e) => {
                if (!props.onEventDrop) return
                e.preventDefault()
                setDragOverDay(cell.date)
              }}
              onDragLeave={() => setDragOverDay(null)}
              onDrop={(e) => {
                if (!props.onEventDrop) return
                e.preventDefault()
                const eventId = e.dataTransfer.getData('text/plain')
                if (eventId) props.onEventDrop(eventId, cell.date)
                setDragOverDay(null)
              }}
              className={`bg-surface min-h-[64px] p-1 flex flex-col gap-0.5 ${cell.inMonth ? '' : 'opacity-40'} ${
                cell.inMonth ? 'cursor-pointer hover:bg-inset' : ''
              } ${dragOverDay === cell.date ? 'bg-accent-soft' : ''}`}
            >
              <span className={`text-[11px] w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-accent text-on-accent font-semibold' : 'text-ink3'}`}>
                {dayNum}
              </span>
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, maxPerDay).map((e) => (
                  <div
                    key={e.id}
                    draggable={!!props.onEventDrop}
                    onDragStart={(ev) => ev.dataTransfer.setData('text/plain', e.id)}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      props.onEventClick?.(e)
                    }}
                    title={`${eventTypeLabels[e.eventType]} — ${e.title}`}
                    className={`text-[10.5px] truncate rounded px-1 py-0.5 bg-inset flex items-center gap-1 ${
                      props.onEventDrop ? 'cursor-grab active:cursor-grabbing' : ''
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TYPE_DOT[e.eventType]}`} />
                    <span className="truncate">{e.title}</span>
                  </div>
                ))}
                {dayEvents.length > maxPerDay && (
                  <span className="text-[10px] text-ink3 px-1">+{dayEvents.length - maxPerDay} más</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
