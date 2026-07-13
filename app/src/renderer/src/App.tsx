import { useCallback, useEffect, useState } from 'react'
import type { Organization, SessionUser } from '@shared/contracts'
import { api } from './api'
import { LoginScreen } from './features/auth/LoginScreen'
import { Shell } from './app/Shell'
import { FirstRunWizard } from './app/FirstRunWizard'
import { ToastProvider } from './components/Toast'

/** Auto-bloqueo (M4/E-08): cierra la sesión sola tras N minutos sin mover el
 * mouse ni el teclado — pensado para la laptop compartida de la secretaria.
 * Relee el ajuste cada 15s para que un cambio en Configuración → Seguridad
 * aplique sin reiniciar la app. `active` solo es true con el Shell visible
 * (no durante el login ni el asistente de primera ejecución). */
function useAutoLock(active: boolean, onIdle: () => void): void {
  useEffect(() => {
    if (!active) return
    let lastActivity = Date.now()
    const resetActivity = (): void => {
      lastActivity = Date.now()
    }
    const events = ['mousemove', 'keydown', 'mousedown', 'wheel', 'touchstart'] as const
    for (const e of events) window.addEventListener(e, resetActivity)

    const interval = setInterval(() => {
      void api.system.getAutoLockMinutes().then((minutes) => {
        if (minutes > 0 && Date.now() - lastActivity >= minutes * 60_000) onIdle()
      })
    }, 15_000)

    return () => {
      for (const e of events) window.removeEventListener(e, resetActivity)
      clearInterval(interval)
    }
  }, [active, onIdle])
}

export default function App(): React.JSX.Element | null {
  const [booted, setBooted] = useState(false)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [firstRunPending, setFirstRunPending] = useState(false)
  const [landOnMembers, setLandOnMembers] = useState(false)
  const [lockedMessage, setLockedMessage] = useState<string | null>(null)

  async function boot(): Promise<void> {
    const [me, organization, pending] = await Promise.all([
      api.auth.me(),
      api.organization.get(),
      api.system.firstRunPending()
    ])
    setUser(me)
    setOrg(organization)
    setFirstRunPending(pending)
    setBooted(true)
  }
  useEffect(() => {
    void boot()
  }, [])

  const handleLogout = useCallback(() => {
    void api.auth.logout().then(() => setUser(null))
  }, [])

  const handleIdleLock = useCallback(() => {
    void api.auth.logout().then(() => {
      setUser(null)
      setLockedMessage('Se cerró tu sesión por inactividad.')
    })
  }, [])

  useAutoLock(booted && user !== null && !firstRunPending, handleIdleLock)

  if (!booted) return null

  return (
    <ToastProvider>
      {!user ? (
        <LoginScreen
          org={org}
          onLogin={(u) => {
            setLockedMessage(null)
            setUser(u)
          }}
          message={lockedMessage}
        />
      ) : firstRunPending ? (
        <FirstRunWizard
          user={user}
          org={org}
          onFinish={(updatedUser) => {
            setUser(updatedUser)
            void api.organization.get().then(setOrg)
            setFirstRunPending(false)
            setLandOnMembers(true)
          }}
        />
      ) : (
        <Shell
          user={user}
          org={org}
          onLogout={handleLogout}
          onUserChanged={setUser}
          initialView={landOnMembers ? 'miembros' : 'inicio'}
        />
      )}
    </ToastProvider>
  )
}
