import { useState } from 'react'
import { DocumentTypesView } from './DocumentTypesView'
import { BackupsView } from './BackupsView'
import { OcrSettingsView } from './OcrSettingsView'
import { TrashView } from './TrashView'
import { OrganizationSettingsView } from './OrganizationSettingsView'
import { SecuritySettingsView } from './SecuritySettingsView'

type Tab = 'organizacion' | 'tipos' | 'respaldos' | 'ocr' | 'papelera' | 'seguridad'

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'organizacion', label: 'Organización' },
  { key: 'tipos', label: 'Tipos de documento' },
  { key: 'respaldos', label: 'Respaldos' },
  { key: 'ocr', label: 'OCR' },
  { key: 'papelera', label: 'Papelera' },
  { key: 'seguridad', label: 'Seguridad' }
]

export function ConfiguracionView(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('organizacion')

  return (
    <div>
      <div className="px-8 pt-6 max-w-6xl mx-auto w-full">
        <div className="flex gap-1 border-b border-line">
          {TABS.map((t) => (
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
      {tab === 'ocr' && <OcrSettingsView />}
      {tab === 'papelera' && <TrashView />}
      {tab === 'seguridad' && <SecuritySettingsView />}
    </div>
  )
}
