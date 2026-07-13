import { useCallback, useEffect, useState } from 'react'
import type { Organization, SessionUser } from '@shared/contracts'
import { api } from './api'
import { LoginScreen } from './features/auth/LoginScreen'
import { Shell } from './app/Shell'
import { FirstRunWizard } from './app/FirstRunWizard'

export default function App(): React.JSX.Element | null {
  const [booted, setBooted] = useState(false)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [firstRunPending, setFirstRunPending] = useState(false)
  const [landOnMembers, setLandOnMembers] = useState(false)

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

  if (!booted) return null
  if (!user) return <LoginScreen org={org} onLogin={setUser} />

  if (firstRunPending) {
    return (
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
    )
  }

  return <Shell user={user} org={org} onLogout={handleLogout} initialView={landOnMembers ? 'miembros' : 'inicio'} />
}
