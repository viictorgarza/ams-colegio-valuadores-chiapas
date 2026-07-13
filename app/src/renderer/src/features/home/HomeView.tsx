import { useEffect, useState } from 'react'
import {
  faBell,
  faCalendarDays,
  faCircleCheck,
  faFolderOpen,
  faMoneyCheckDollar,
  faTriangleExclamation,
  faUsers
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type {
  CalendarEvent,
  ContractOutput,
  ExpedienteOverviewItem,
  MemberListItem,
  SessionUser,
  UpcomingExpiration
} from '@shared/contracts'
import { contracts, eventTypeLabels } from '@shared/contracts'
import { api } from '@renderer/api'
import { Icon } from '@renderer/components/ui'
import { MembersTable } from '@renderer/features/members/MembersTable'
import { EventDetailModal } from '@renderer/features/events/EventDetailModal'

type SystemInfo = ContractOutput<typeof contracts.system.info>

const TYPE_DOT: Record<CalendarEvent['eventType'], string> = {
  reunion: 'bg-accent',
  asamblea: 'bg-warn',
  ponencia: 'bg-good',
  otro: 'bg-ink3'
}

/** "YYYY-MM-DD" en hora local — evitar toISOString() (convierte a UTC). */
function todayLocal(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function shortDateLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(y!, m! - 1, d!)
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export function HomeView(props: {
  user: SessionUser
  onOpenMember: (id: string) => void
  onOpenMembers: () => void
  onOpenCalendar: () => void
  onOpenAnnuities: (filter?: 'pendiente') => void
  onOpenDocuments: () => void
}): React.JSX.Element {
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [expirations, setExpirations] = useState<UpcomingExpiration[] | null>(null)
  const [members, setMembers] = useState<MemberListItem[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [pendingPayments, setPendingPayments] = useState<number | null>(null)
  const [expedientes, setExpedientes] = useState<ExpedienteOverviewItem[] | null>(null)
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null)

  useEffect(() => {
    void api.system.info().then(setInfo)
    void api.documents.upcomingExpirations({ withinDays: 30 }).then(setExpirations)
    void api.members.list({}).then(setMembers)
    void api.events.list().then(setEvents)
    void api.payments
      .annuitiesByYear({ year: new Date().getFullYear() })
      .then((rows) => setPendingPayments(rows.filter((r) => r.status === 'pendiente').length))
    void api.documents.overview().then(setExpedientes)
  }, [])

  const sinDocumentos = expedientes?.filter((e) => e.uploadedTotal === 0).length ?? null
  const today = todayLocal()
  const upcomingEvents = events.filter((e) => e.startsAt.slice(0, 10) >= today).slice(0, 8)

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <h1 className="text-xl font-semibold tracking-tight">
        Hola, {props.user.fullName.split(' ')[0]}.
      </h1>
      <p className="text-[13px] text-ink3 mt-1">Un vistazo del sistema y lo que necesita tu atención.</p>

      {info && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={faUsers} label="Miembros" value={String(info.memberCount)} onClick={props.onOpenMembers} />
          <AvisosStat
            expiredCount={expirations ? expirations.filter((e) => e.expiresAt < today).length : null}
            upcomingCount={expirations ? expirations.filter((e) => e.expiresAt >= today).length : null}
          />
          <CountStat
            icon={faMoneyCheckDollar}
            label="Pendientes de pago"
            count={pendingPayments}
            warnWhenPositive
            onClick={() => props.onOpenAnnuities('pendiente')}
          />
          <CountStat
            icon={faFolderOpen}
            label="Sin documentos"
            count={sinDocumentos}
            warnWhenPositive
            onClick={props.onOpenDocuments}
          />
        </div>
      )}

      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-ink3 flex items-center gap-1.5">
            <Icon icon={faCalendarDays} className="w-3 h-3" />
            Próximos eventos
          </h2>
          <button onClick={props.onOpenCalendar} className="text-[12.5px] text-accent font-semibold hover:underline">
            Ver calendario completo
          </button>
        </div>
        {upcomingEvents.length === 0 ? (
          <button
            onClick={props.onOpenCalendar}
            className="text-[13px] text-ink3 border border-dashed border-line rounded-xl px-4 py-2.5 w-full text-left hover:bg-inset"
          >
            Sin eventos próximos — crea uno con "Nuevo Evento".
          </button>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {upcomingEvents.map((e) => (
              <button
                key={e.id}
                onClick={() => setDetailEvent(e)}
                title={eventTypeLabels[e.eventType]}
                className="flex items-center gap-2 shrink-0 border border-line rounded-full pl-1.5 pr-3.5 py-1.5 bg-surface hover:border-accent hover:bg-accent-soft transition-colors"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${TYPE_DOT[e.eventType]}`} />
                <span className="text-[12.5px] font-semibold tabular-nums text-ink2">{shortDateLabel(e.startsAt.slice(0, 10))}</span>
                <span className="text-[13px] max-w-[180px] truncate">{e.title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        <h2 className="text-[13px] font-semibold text-ink2 mb-2">Miembros</h2>
        <MembersTable items={members} onOpen={props.onOpenMember} emptyMessage="Aún no hay miembros." />
      </div>

      {detailEvent && <EventDetailModal event={detailEvent} onClose={() => setDetailEvent(null)} />}
    </div>
  )
}

function Stat(props: {
  icon: IconDefinition
  label: string
  value: string
  onClick?: () => void
}): React.JSX.Element {
  const Tag = props.onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={props.onClick}
      className={`text-left bg-surface border border-line rounded-xl px-4 py-3 ${
        props.onClick ? 'hover:border-accent hover:bg-accent-soft transition-colors' : ''
      }`}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink3">
        <Icon icon={props.icon} className="w-3 h-3" />
        {props.label}
      </div>
      <div className="text-lg font-semibold tabular-nums mt-0.5">{props.value}</div>
    </Tag>
  )
}

/** Cuadrito compacto de conteo con color de aviso cuando el número es mayor a cero
 * (Pendientes de pago, Sin documentos) — mismo criterio de un-solo-color que Avisos. */
function CountStat(props: {
  icon: IconDefinition
  label: string
  count: number | null
  warnWhenPositive?: boolean
  onClick?: () => void
}): React.JSX.Element {
  const { count } = props
  const isWarn = props.warnWhenPositive && count !== null && count > 0
  const Tag = props.onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={props.onClick}
      className={`text-left bg-surface border border-line rounded-xl px-4 py-3 ${
        props.onClick ? 'hover:border-accent hover:bg-accent-soft transition-colors' : ''
      }`}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink3">
        <Icon icon={props.icon} className="w-3 h-3" />
        {props.label}
      </div>
      <div className={`text-lg font-semibold tabular-nums mt-0.5 ${isWarn ? 'text-warn' : ''}`}>
        {count === null ? '…' : count}
      </div>
    </Tag>
  )
}

/** Reemplaza el antiguo "Tablas en la base" (Victor, 2026-07-12): mismo tamaño de
 * cuadrito que el resto de las estadísticas, pero con el estatus de documentos
 * por vencer adentro — un solo color de aviso, sin lista densa. */
function AvisosStat(props: { expiredCount: number | null; upcomingCount: number | null }): React.JSX.Element {
  const { expiredCount, upcomingCount } = props
  const loading = expiredCount === null || upcomingCount === null
  const hasExpired = !loading && expiredCount > 0
  const hasUpcoming = !loading && upcomingCount > 0
  const tone = loading ? 'text-ink3' : hasExpired ? 'text-bad' : hasUpcoming ? 'text-warn' : 'text-good'
  return (
    <div className="text-left bg-surface border border-line rounded-xl px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink3">
        <Icon icon={faBell} className="w-3 h-3" />
        Avisos
      </div>
      <div className={`flex items-center gap-1.5 text-[13px] font-semibold mt-1 ${tone}`}>
        {!loading && (
          <Icon icon={hasExpired || hasUpcoming ? faTriangleExclamation : faCircleCheck} className="w-3.5 h-3.5 shrink-0" />
        )}
        {loading
          ? 'Cargando…'
          : hasExpired
            ? `${expiredCount} vencido${expiredCount === 1 ? '' : 's'}${hasUpcoming ? ` · ${upcomingCount} por vencer` : ''}`
            : hasUpcoming
              ? `${upcomingCount} documento${upcomingCount === 1 ? '' : 's'} por vencer`
              : 'Sin documentos por vencer'}
      </div>
    </div>
  )
}
