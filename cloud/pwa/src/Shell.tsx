import { useState } from 'react'
import type { SessionUser } from './types'
import { HomeView } from './views/HomeView'
import { MembersView } from './views/MembersView'
import { MemberDetailView } from './views/MemberDetailView'
import { AnnuitiesView } from './views/AnnuitiesView'
import { CalendarView } from './views/CalendarView'
import { AssembliesView } from './views/AssembliesView'

export type Route =
  | { name: 'home' }
  | { name: 'members' }
  | { name: 'member'; id: string }
  | { name: 'annuities' }
  | { name: 'calendar' }
  | { name: 'assemblies' }

const TABS: Array<{ route: Route['name']; label: string; icon: string }> = [
  { route: 'home', label: 'Inicio', icon: 'M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10' },
  {
    route: 'members',
    label: 'Miembros',
    icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75'
  },
  {
    route: 'annuities',
    label: 'Anualidades',
    icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6'
  },
  {
    route: 'calendar',
    label: 'Calendario',
    icon: 'M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2M16 2v4M8 2v4M3 10h18'
  },
  {
    route: 'assemblies',
    label: 'Asistencias',
    icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11'
  }
]

function TabIcon({ d, active }: { d: string; active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-6 w-6 ${active ? 'text-accent' : 'text-ink3'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  )
}

export function Shell({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [route, setRoute] = useState<Route>({ name: 'home' })

  const toggleTheme = (): void => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('ams_theme', next)
  }

  const activeTab = route.name === 'member' ? 'members' : route.name

  return (
    <div className="flex min-h-screen flex-col">
      <header className="safe-top sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src="/icons/icon-192.png" alt="" className="h-8 w-8 rounded-lg" />
            <div>
              <p className="text-sm font-semibold leading-tight">AMS</p>
              <p className="text-xs leading-tight text-ink3">CEVP Chiapas</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink2 hover:bg-inset"
              aria-label="Cambiar tema"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              onClick={onLogout}
              className="flex min-h-11 items-center gap-2 rounded-full px-3 text-sm text-ink2 hover:bg-inset"
            >
              <span className="hidden sm:inline">{user.fullName}</span>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path
                  d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 pb-24">
        {route.name === 'home' && <HomeView user={user} onNavigate={setRoute} />}
        {route.name === 'members' && <MembersView onOpen={(id) => setRoute({ name: 'member', id })} />}
        {route.name === 'member' && (
          <MemberDetailView id={route.id} onBack={() => setRoute({ name: 'members' })} />
        )}
        {route.name === 'annuities' && <AnnuitiesView onOpenMember={(id) => setRoute({ name: 'member', id })} />}
        {route.name === 'calendar' && <CalendarView />}
        {route.name === 'assemblies' && <AssembliesView />}
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl">
          {TABS.map((tab) => (
            <button
              key={tab.route}
              onClick={() => setRoute({ name: tab.route } as Route)}
              className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5"
            >
              <TabIcon d={tab.icon} active={activeTab === tab.route} />
              <span className={`text-[11px] ${activeTab === tab.route ? 'font-semibold text-accent' : 'text-ink3'}`}>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
