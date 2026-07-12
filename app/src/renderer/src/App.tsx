import { useCallback, useEffect, useState } from 'react'
import type { Organization, SessionUser } from '@shared/contracts'
import { api } from './api'
import { LoginScreen } from './features/auth/LoginScreen'
import { Shell } from './app/Shell'

export default function App(): React.JSX.Element | null {
  const [booted, setBooted] = useState(false)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)

  useEffect(() => {
    void (async () => {
      const [me, organization] = await Promise.all([api.auth.me(), api.organization.get()])
      setUser(me)
      setOrg(organization)
      setBooted(true)
    })()
  }, [])

  const handleLogout = useCallback(() => {
    void api.auth.logout().then(() => setUser(null))
  }, [])

  if (!booted) return null
  if (!user) return <LoginScreen org={org} onLogin={setUser} />
  return <Shell user={user} org={org} onLogout={handleLogout} />
}
