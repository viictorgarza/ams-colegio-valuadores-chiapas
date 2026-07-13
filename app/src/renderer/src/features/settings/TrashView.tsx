import { useEffect, useState } from 'react'
import {
  faCalendarDays,
  faFileLines,
  faMoneyBillWave,
  faTrashCanArrowUp,
  faUserGroup,
  faUsers
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { TrashItem, TrashType } from '@shared/contracts'
import { api } from '@renderer/api'
import { Button, Icon } from '@renderer/components/ui'

const TYPE_LABELS: Record<TrashType, string> = {
  member: 'Miembro',
  payment: 'Pago',
  event: 'Evento',
  document: 'Documento',
  assembly: 'Asamblea'
}

const TYPE_ICONS: Record<TrashType, IconDefinition> = {
  member: faUsers,
  payment: faMoneyBillWave,
  event: faCalendarDays,
  document: faFileLines,
  assembly: faUserGroup
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** Configuración → Papelera (M4/E-08): vista única que agrega el borrado
 * lógico de todas las entidades (miembros, pagos, eventos, documentos,
 * asambleas) con restauración de un clic. Nada se borra en definitiva. */
export function TrashView(): React.JSX.Element {
  const [items, setItems] = useState<TrashItem[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  function reload(): void {
    void api.trash.list().then(setItems)
  }
  useEffect(reload, [])

  async function restore(item: TrashItem): Promise<void> {
    setBusyId(item.id)
    try {
      await api.trash.restore({ type: item.type, id: item.id })
      reload()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-[13px] text-ink3 mt-0.5">Papelera</p>
      </div>
      <p className="text-[13px] text-ink3 mb-4">
        Nada se borra en definitiva. Miembros, pagos, eventos, documentos y asambleas eliminados quedan aquí hasta
        que los restaures.
      </p>

      {items === null && <p className="text-[13px] text-ink3">Cargando…</p>}

      {items && items.length === 0 && (
        <div className="border border-line rounded-xl bg-surface p-8 text-center text-[13.5px] text-ink3">
          La papelera está vacía.
        </div>
      )}

      {items && items.length > 0 && (
        <div className="border border-line rounded-xl bg-surface divide-y divide-line">
          {items.map((item) => (
            <div key={`${item.type}:${item.id}`} className="px-4 py-3 flex items-center gap-3 flex-wrap">
              <Icon icon={TYPE_ICONS[item.type]} className="w-3.5 h-3.5 text-ink3 shrink-0" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink3 w-20 shrink-0">
                {TYPE_LABELS[item.type]}
              </span>
              <div className="flex-1 min-w-[180px]">
                <div className="text-[14px] font-medium">{item.label}</div>
                <div className="text-[12.5px] text-ink3">
                  {item.detail ? `${item.detail} · ` : ''}Eliminado el {formatDate(item.deletedAt)}
                </div>
              </div>
              <Button
                icon={faTrashCanArrowUp}
                disabled={busyId === item.id}
                onClick={() => void restore(item)}
              >
                Restaurar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
