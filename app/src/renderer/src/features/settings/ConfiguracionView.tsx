import { useState } from 'react'
import type { SessionUser } from '@shared/contracts'
import { DocumentTypesView } from './DocumentTypesView'
import { BackupsView } from './BackupsView'
import { TrashView } from './TrashView'
import { OrganizationSettingsView } from './OrganizationSettingsView'
import { SecuritySettingsView } from './SecuritySettingsView'
import { UsersSettingsView } from './UsersSettingsView'

type Tab = 'organizacion' | 'tipos' | 'respaldos' | 'usuarios' | 'papelera' | 'seguridad'

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'organizacion', label: 'Organización' },
  { key: 'tipos', label: 'Tipos de documento' },
  { key: 'respaldos', label: 'Respaldos' },
  { key: 'usuarios', label: 'Usuarios' },
  { key: 'papelera', label: 'Papelera' },
  { key: 'seguridad', label: 'Seguridad' }
]

export function ConfiguracionView(props: {
  user: SessionUser
  onUserChanged: (u: SessionUser) => void
  initialTab?: Tab
}): React.JSX.Element {
  const [tab, setTab] = useState<Tab>(props.initialTab ?? 'organizacion')
  const tabs = TABS.filter((t) => t.key !== 'usuarios' || props.user.role === 'admin')

  return (
    <div>
      <div className="px-8 pt-6 max-w-6xl mx-auto w-full">
        <div className="flex gap-1 border-b border-line">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={
                t.key === tab
                  ? 'px-3 py-2 text-[13px] font-semibold text-accent border-b-2 border-accent -mb-px'
                  : 'px-3 py-2 text-[13px] text-ink2 hover:text-ink border-b-2 border-transparent -mb-px'
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'organizacion' && <OrganizationSettingsView />}
      {tab === 'tipos' && <DocumentTypesView />}
      {tab === 'respaldos' && <BackupsView />}
      {tab === 'usuarios' && props.user.role === 'admin' && (
        <UsersSettingsView user={props.user} onUserChanged={props.onUserChanged} />
      )}
      {tab === 'papelera' && <TrashView />}
      {tab === 'seguridad' && <SecuritySettingsView />}
    </div>
  )
}
