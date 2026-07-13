import { useEffect, useState } from 'react'
import { api } from '../api'
import type { SessionUser, SystemStats } from '../types'
import { eventTypeLabels, formatDateShort, formatTime } from '../types'
import type { Route } from '../Shell'
import { Card, Spinner } from '../ui'

// Mismo criterio que HomeView.tsx del escritorio: saludo por hora del día.
function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

export function HomeView({ user, onNavigate }: { user: SessionUser; onNavigate: (r: Route) => void }) {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.system
      .stats()
      .then(setStats)
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) return <p className="text-bad">{error}</p>
  if (!stats) return <Spinner />

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">
        {greeting()}, {user.fullName.split(' ')[0]}
      </h1>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <Card onClick={() => onNavigate({ name: 'members' })}>
          <p className="text-sm text-ink2">Miembros</p>
          <p className="mt-1 text-3xl font-semibold text-accent">{stats.membersCount}</p>
        </Card>
        <Card onClick={() => onNavigate({ name: 'annuities' })}>
          <p className="text-sm text-ink2">Pendientes de pago {stats.year}</p>
          <p className={`mt-1 text-3xl font-semibold ${stats.pendingPayments > 0 ? 'text-warn' : 'text-good'}`}>
            {stats.pendingPayments}
          </p>
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Próximos eventos</h2>
      {stats.upcomingEvents.length === 0 ? (
        <Card>
          <p className="text-ink3">No hay eventos próximos.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {stats.upcomingEvents.map((e) => (
            <Card key={e.id} onClick={() => onNavigate({ name: 'calendar' })}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{e.title}</p>
                  <p className="text-sm text-ink2">
                    {formatDateShort(e.startsAt)}
                    {formatTime(e.startsAt) && ` · ${formatTime(e.startsAt)}`}
                    {e.location && ` · ${e.location}`}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent">
                  {eventTypeLabels[e.eventType]}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
