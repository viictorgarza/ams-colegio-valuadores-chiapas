import { useState } from 'react'
import { DocumentTypesView } from './DocumentTypesView'
import { BackupsView } from './BackupsView'
import { OcrSettingsView } from './OcrSettingsView'

type Tab = 'tipos' | 'respaldos' | 'ocr'

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'tipos', label: 'Tipos de documento' },
  { key: 'respaldos', label: 'Respaldos' },
  { key: 'ocr', label: 'OCR' }
]

export function ConfiguracionView(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('tipos')

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
      {tab === 'tipos' && <DocumentTypesView />}
      {tab === 'respaldos' && <BackupsView />}
      {tab === 'ocr' && <OcrSettingsView />}
    </div>
  )
}
