import { useCallback, useEffect, useState } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler } from './api'
import type { SessionUser } from './types'
import { ToastProvider } from './toast'
import { LoginView } from './views/LoginView'
import { ChangePasswordView } from './views/ChangePasswordView'
import { Shell } from './Shell'
import { Spinner } from './ui'

export function App() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [checking, setChecking] = useState(true)

  const handleLogout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    if (!getToken()) {
      setChecking(false)
      return
    }
    api
      .me()
      .then((r) => setUser(r.user))
      .catch(() => setToken(null))
      .finally(() => setChecking(false))
  }, [])

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <ToastProvider>
      {!user ? (
        <LoginView onLogin={setUser} />
      ) : user.mustChangePassword ? (
        <ChangePasswordView onDone={(u) => setUser(u)} user={user} />
      ) : (
        <Shell
          user={user}
          onLogout={() => {
            void api.logout().catch(() => {})
            handleLogout()
          }}
        />
      )}
    </ToastProvider>
  )
}
