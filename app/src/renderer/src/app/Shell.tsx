import { useEffect, useState } from 'react'
import type { LastBackup, Organization, SessionUser } from '@shared/contracts'
import { api } from '@renderer/api'
import { MembersList, NewMemberModal } from '@renderer/features/members/MembersList'
import { MemberDetailView } from '@renderer/features/members/MemberDetail'
import { HomeView } from '@renderer/features/home/HomeView'
import { AnnuitiesView } from '@renderer/features/annuities/AnnuitiesView'
import { CalendarView, NewEventModal } from '@renderer/features/events/CalendarView'
import { DocumentsOverviewView } from '@renderer/features/documents/DocumentsOverviewView'
import { ConfiguracionView } from '@renderer/features/settings/ConfiguracionView'
import { AssembliesView, NewAssemblyModal } from '@renderer/features/assemblies/AssembliesView'
import { GlobalSearch } from './GlobalSearch'
import { NewPaymentQuickModal } from './NewPaymentQuickModal'
import { NewMenuButton, NewCommandPalette, type NewMenuAction } from './NewMenu'
import { Icon } from '@renderer/components/ui'
import { OrgLogo } from '@renderer/components/OrgLogo'
import { ThemeToggle } from './ThemeToggle'
import {
  faHouse,
  faUsers,
  faCalendarCheck,
  faCalendarDays,
  faFolderOpen,
  faGear,
  faClipboardCheck
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'

type View =
  | { name: 'inicio' }
  | { name: 'miembros' }
  | { name: 'miembro'; id: string }
  | { name: 'anualidades'; filter?: 'pendiente' }
  | { name: 'calendario' }
  | { name: 'documentos' }
  | { name: 'asistencias' }
  | { name: 'configuracion'; tab?: 'respaldos' }

const NAV: Array<{
  key: 'inicio' | 'miembros' | 'anualidades' | 'calendario' | 'documentos' | 'asistencias' | 'configuracion'
  label: string
  icon: IconDefinition
  enabled: boolean
}> = [
  { key: 'inicio', label: 'Inicio', icon: faHouse, enabled: true },
  { key: 'miembros', label: 'Miembros', icon: faUsers, enabled: true },
  { key: 'anualidades', label: 'Anualidades', icon: faCalendarCheck, enabled: true },
  { key: 'calendario', label: 'Calendario', icon: faCalendarDays, enabled: true },
  { key: 'documentos', label: 'Documentos', icon: faFolderOpen, enabled: true },
  { key: 'asistencias', label: 'Asistencias', icon: faClipboardCheck, enabled: true },
  { key: 'configuracion', label: 'Configuración', icon: faGear, enabled: true }
]

export function Shell(props: {
  user: SessionUser
  org: Organization | null
  onLogout: () => void
  onUserChanged: (u: SessionUser) => void
  initialView?: 'inicio' | 'miembros'
}): React.JSX.Element {
  const [view, setView] = useState<View>(() =>
    props.initialView === 'miembros' ? { name: 'miembros' } : { name: 'inicio' }
  )
  const [showNewMember, setShowNewMember] = useState(false)
  const [showNewPayment, setShowNewPayment] = useState(false)
  const [showNewEvent, setShowNewEvent] = useState(false)
  const [showNewAssembly, setShowNewAssembly] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [homeRefreshKey, setHomeRefreshKey] = useState(0)
  const [lastBackup, setLastBackup] = useState<LastBackup | null | undefined>(undefined)
  const active = view.name === 'miembro' ? 'miembros' : view.name

  function handleNewMenuPick(action: NewMenuAction): void {
    if (action === 'miembro') setShowNewMember(true)
    else if (action === 'pago') setShowNewPayment(true)
    else if (action === 'evento') setShowNewEvent(true)
    else setShowNewAssembly(true)
  }

  // Cmd+N (mac) / Ctrl+N (windows) abre la paleta flotante de "Nuevo" desde cualquier vista.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setShowCommandPalette(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    void api.backups.getLast().then(setLastBackup)
  }, [view.name])

  return (
    <div className="h-screen flex overflow-hidden">
      <aside className="w-[212px] shrink-0 bg-sidebar border-r border-sidebar-line flex flex-col p-3 h-full min-h-0">
        <div className="flex items-center gap-2.5 px-2 pb-4 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-white/95 grid place-items-center shrink-0 p-1 shadow-sm">
            <OrgLogo org={props.org} className="w-full h-full object-contain" />
          </div>
          <div className="text-[11.5px] font-semibold leading-tight text-sidebar-ink">
            {props.org?.name ?? 'AMS'}
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 flex-1 min-h-0 overflow-y-auto">
          {NAV.map((item) => (
            <button
              key={item.key}
              disabled={!item.enabled}
              title={item.enabled ? undefined : 'Disponible en un hito posterior'}
              onClick={() => {
                if (!item.enabled) return
                if (item.key === 'miembros') setView({ name: 'miembros' })
                else if (item.key === 'anualidades') setView({ name: 'anualidades' })
                else if (item.key === 'calendario') setView({ name: 'calendario' })
                else if (item.key === 'documentos') setView({ name: 'documentos' })
                else if (item.key === 'asistencias') setView({ name: 'asistencias' })
                else if (item.key === 'configuracion') setView({ name: 'configuracion' })
                else setView({ name: 'inicio' })
              }}
              className={
                item.key === active
                  ? 'relative flex items-center gap-2.5 text-left pl-3.5 pr-2.5 py-1.5 rounded-lg bg-sidebar-active-bg text-sidebar-active-ink font-semibold text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-sidebar-active-ink before:content-[""] before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-sidebar-active-ink'
                  : item.enabled
                    ? 'flex items-center gap-2.5 text-left px-2.5 py-1.5 rounded-lg text-sidebar-ink2 hover:bg-white/5 hover:text-sidebar-ink text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-sidebar-active-ink'
                    : 'flex items-center gap-2.5 text-left px-2.5 py-1.5 rounded-lg text-sidebar-ink2/50 text-[13.5px] cursor-not-allowed'
              }
            >
              <Icon icon={item.icon} className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>
        {lastBackup !== undefined && (
          <button
            onClick={() => setView({ name: 'configuracion', tab: 'respaldos' })}
            title="Ir a Configuración → Respaldos"
            className="shrink-0 px-2 pb-2 text-[11px] text-sidebar-ink2 hover:text-sidebar-ink text-left outline-none focus-visible:ring-2 focus-visible:ring-sidebar-active-ink rounded"
          >
            {lastBackup?.finishedAt
              ? `Último respaldo: ${new Date(lastBackup.finishedAt).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`
              : 'Sin respaldos todavía'}
          </button>
        )}
        <div className="shrink-0 border-t border-sidebar-line pt-3 px-2 flex items-center justify-between gap-2">
          <ThemeToggle />
          <div className="text-xs text-sidebar-ink2 flex flex-col items-end gap-1">
            <span className="text-sidebar-ink">{props.user.fullName}</span>
            <button onClick={props.onLogout} className="text-sidebar-ink2 hover:text-sidebar-ink">
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        <header className="sticky top-0 z-10 bg-surface border-b border-line shadow-xs px-6 py-3 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div />
          <div className="flex justify-center">
            <GlobalSearch onOpenMember={(id) => setView({ name: 'miembro', id })} />
          </div>
          <div className="flex items-center justify-end shrink-0 whitespace-nowrap pl-4">
            {view.name === 'inicio' && <NewMenuButton onPick={handleNewMenuPick} />}
          </div>
        </header>

        <main className="flex-1 min-w-0 overflow-y-auto">
          {view.name === 'inicio' && (
            <HomeView
              key={homeRefreshKey}
              user={props.user}
              onOpenMember={(id) => setView({ name: 'miembro', id })}
              onOpenMembers={() => setView({ name: 'miembros' })}
              onOpenCalendar={() => setView({ name: 'calendario' })}
              onOpenAnnuities={(filter) => setView({ name: 'anualidades', filter })}
              onOpenDocuments={() => setView({ name: 'documentos' })}
            />
          )}
          {view.name === 'miembros' && (
            <MembersList onOpen={(id) => setView({ name: 'miembro', id })} />
          )}
          {view.name === 'miembro' && (
            <MemberDetailView id={view.id} onBack={() => setView({ name: 'miembros' })} />
          )}
          {view.name === 'anualidades' && (
            <AnnuitiesView onOpenMember={(id) => setView({ name: 'miembro', id })} initialStatusFilter={view.filter} />
          )}
          {view.name === 'calendario' && <CalendarView />}
          {view.name === 'documentos' && (
            <DocumentsOverviewView onOpenMember={(id) => setView({ name: 'miembro', id })} />
          )}
          {view.name === 'asistencias' && <AssembliesView />}
          {view.name === 'configuracion' && (
            <ConfiguracionView user={props.user} onUserChanged={props.onUserChanged} initialTab={view.tab} />
          )}
        </main>
      </div>

      {showNewMember && (
        <NewMemberModal
          onClose={() => setShowNewMember(false)}
          onCreated={(id) => {
            setShowNewMember(false)
            setView({ name: 'miembro', id })
          }}
        />
      )}
      {showNewPayment && (
        <NewPaymentQuickModal
          onClose={() => setShowNewPayment(false)}
          onCreated={(memberId) => {
            setShowNewPayment(false)
            setView({ name: 'miembro', id: memberId })
          }}
        />
      )}
      {showNewEvent && (
        <NewEventModal
          onClose={() => setShowNewEvent(false)}
          onCreated={() => {
            setShowNewEvent(false)
            setHomeRefreshKey((k) => k + 1)
          }}
        />
      )}
      {showNewAssembly && (
        <NewAssemblyModal
          onClose={() => setShowNewAssembly(false)}
          onCreated={() => {
            setShowNewAssembly(false)
            setView({ name: 'asistencias' })
          }}
        />
      )}
      {showCommandPalette && (
        <NewCommandPalette
          onClose={() => setShowCommandPalette(false)}
          onPick={(action) => {
            setShowCommandPalette(false)
            handleNewMenuPick(action)
          }}
        />
      )}
    </div>
  )
}
