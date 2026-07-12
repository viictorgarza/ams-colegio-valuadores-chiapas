import { useEffect, useState } from 'react'
import { faFileExport } from '@fortawesome/free-solid-svg-icons'
import type { ExpedienteOverviewItem } from '@shared/contracts'
import { api } from '@renderer/api'
import { Button, SortableTh } from '@renderer/components/ui'
import { useSort } from '@renderer/components/useSort'
import { useColumnOrder } from '@renderer/components/useColumnOrder'

type ColKey = 'memberNumber' | 'title' | 'apellidos' | 'givenNames' | 'progress'

const COLUMN_LABELS: Record<ColKey, string> = {
  memberNumber: 'No.',
  title: 'Título',
  apellidos: 'Apellidos',
  givenNames: 'Nombres',
  progress: 'Documentos requeridos'
}
const DEFAULT_ORDER: ColKey[] = ['memberNumber', 'title', 'apellidos', 'givenNames', 'progress']

function progressRatio(item: ExpedienteOverviewItem): number {
  return item.requiredTotal > 0 ? item.requiredCompleted / item.requiredTotal : 0
}

function ProgressBar(props: { completed: number; total: number }): React.JSX.Element {
  const ratio = props.total > 0 ? props.completed / props.total : 0
  const tone = ratio >= 1 ? 'bg-good' : ratio > 0 ? 'bg-warn' : 'bg-bad'
  return (
    <div className="flex items-center gap-2 min-w-[160px]">
      <div className="flex-1 h-2 rounded-full bg-inset overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      <span className="text-[12px] tabular-nums text-ink2 shrink-0">
        {props.completed}/{props.total}
      </span>
    </div>
  )
}

function cell(key: ColKey, item: ExpedienteOverviewItem): React.ReactNode {
  if (key === 'memberNumber') return <span className="tabular-nums text-ink2">{item.memberNumber}</span>
  if (key === 'title') return item.title ?? '—'
  if (key === 'apellidos') return item.apellidos ?? '—'
  if (key === 'givenNames') return item.givenNames
  return <ProgressBar completed={item.requiredCompleted} total={item.requiredTotal} />
}

export function DocumentsOverviewView(props: { onOpenMember: (id: string) => void }): React.JSX.Element {
  const [items, setItems] = useState<ExpedienteOverviewItem[]>([])
  const [exporting, setExporting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    void api.documents.overview().then(setItems)
  }, [])

  async function exportAll(): Promise<void> {
    setExporting(true)
    setNotice(null)
    try {
      const result = await api.documents.exportAll()
      setNotice(
        result.saved
          ? `Se exportaron los expedientes de ${result.memberCount} miembros a ${result.path}`
          : 'Se canceló la exportación.'
      )
    } finally {
      setExporting(false)
    }
  }

  const sort = useSort<ColKey>('memberNumber')
  const rows = sort.sorted(items, {
    memberNumber: (i) => i.memberNumber,
    title: (i) => i.title,
    apellidos: (i) => i.apellidos,
    givenNames: (i) => i.givenNames,
    progress: (i) => progressRatio(i)
  })
  const cols = useColumnOrder('table-cols:documents-overview-v3', DEFAULT_ORDER)
  const order = cols.order as ColKey[]

  const sinDocumentos = items.filter((i) => i.uploadedTotal === 0).length

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-start gap-3 mb-5">
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">Documentos</h1>
          <p className="text-[13px] text-ink3 mt-0.5">
            {items.length} miembros · {sinDocumentos} sin ningún documento cargado
          </p>
        </div>
        <Button icon={faFileExport} disabled={exporting} onClick={() => void exportAll()}>
          {exporting ? 'Exportando…' : 'Exportar'}
        </Button>
      </div>

      {notice && <p className="text-[13px] text-good bg-good-bg rounded-lg px-3 py-2 mb-4">{notice}</p>}

      <div className="border border-line rounded-xl bg-surface overflow-x-auto">
        <table className="w-full text-[13.5px] min-w-[640px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-ink3">
              {order.map((key) => (
                <SortableTh
                  key={key}
                  label={COLUMN_LABELS[key]}
                  sortKey={key}
                  activeKey={sort.key}
                  dir={sort.dir}
                  onClick={(k) => sort.toggle(k as ColKey)}
                  onReorder={(from, to) => cols.moveColumn(from, to)}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={order.length} className="px-4 py-10 text-center text-ink3">
                  Aún no hay miembros.
                </td>
              </tr>
            )}
            {rows.map((item) => (
              <tr
                key={item.memberId}
                onClick={() => props.onOpenMember(item.memberId)}
                className="cursor-pointer border-b border-line last:border-b-0 hover:bg-inset"
              >
                {order.map((key) => (
                  <td key={key} className="px-4 py-2.5 whitespace-nowrap">
                    {cell(key, item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
