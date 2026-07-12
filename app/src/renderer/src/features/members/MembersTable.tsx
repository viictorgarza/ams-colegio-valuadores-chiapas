import { faIdBadge } from '@fortawesome/free-solid-svg-icons'
import type { MemberListItem } from '@shared/contracts'
import { Chip, SortableTh, statusTone } from '@renderer/components/ui'
import { useSort } from '@renderer/components/useSort'
import { useColumnOrder } from '@renderer/components/useColumnOrder'

type ColKey = 'memberNumber' | 'title' | 'givenNames' | 'apellidos' | 'phone' | 'statusName'

function apellidos(m: MemberListItem): string | null {
  return [m.paternalSurname, m.maternalSurname].filter(Boolean).join(' ') || null
}

const COLUMNS: Record<ColKey, { label: string; accessor: (m: MemberListItem) => string | number | null }> = {
  memberNumber: { label: 'No.', accessor: (m) => m.memberNumber },
  title: { label: 'Título', accessor: (m) => m.title },
  givenNames: { label: 'Nombres', accessor: (m) => m.givenNames },
  apellidos: { label: 'Apellidos', accessor: apellidos },
  phone: { label: 'Celular', accessor: (m) => m.phone },
  statusName: { label: 'Estado', accessor: (m) => m.statusName }
}
// Orden pedido por Victor (2026-07-12): No. - Título - Nombres - Apellidos - Celular - Estado.
const DEFAULT_ORDER: ColKey[] = ['memberNumber', 'title', 'givenNames', 'apellidos', 'phone', 'statusName']

function cell(key: ColKey, m: MemberListItem): React.ReactNode {
  if (key === 'memberNumber') return <span className="tabular-nums text-ink2">{m.memberNumber}</span>
  if (key === 'title') return m.title ?? '—'
  if (key === 'givenNames') return m.givenNames
  if (key === 'apellidos') return apellidos(m) ?? '—'
  if (key === 'phone') return <span className="tabular-nums text-ink2">{m.phone ?? '—'}</span>
  return (
    <Chip tone={statusTone(m.statusCode)} dot>
      {m.statusName}
    </Chip>
  )
}

/** Tabla de miembros ordenable y con columnas reordenables — compartida entre
 * Miembros e Inicio. El orden de columnas se recuerda por usuaria (localStorage).
 * Título/Nombre/Apellidos van separados (2026-07) para que ordenar por apellido
 * sea posible, en vez de depender del nombre completo concatenado. */
export function MembersTable(props: {
  items: MemberListItem[]
  onOpen: (id: string) => void
  emptyMessage?: string
  highlightedId?: string
  onHover?: (id: string) => void
}): React.JSX.Element {
  const sort = useSort<ColKey>('memberNumber')
  const cols = useColumnOrder('table-cols:members-v3', DEFAULT_ORDER)
  const accessors = Object.fromEntries(
    Object.entries(COLUMNS).map(([k, v]) => [k, v.accessor])
  ) as Record<ColKey, (m: MemberListItem) => string | number | null>
  const rows = sort.sorted(props.items, accessors)
  const order = cols.order as ColKey[]

  return (
    <div className="border border-line rounded-xl bg-surface overflow-x-auto">
      <table className="w-full text-[13.5px] min-w-[760px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-ink3">
            {order.map((key) => (
              <SortableTh
                key={key}
                label={COLUMNS[key].label}
                sortKey={key}
                activeKey={sort.key}
                dir={sort.dir}
                onClick={(k) => sort.toggle(k as ColKey)}
                onReorder={(from, to) => cols.moveColumn(from, to)}
              />
            ))}
            <th className="px-4 py-2.5 border-b border-line font-semibold" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={order.length + 1} className="px-4 py-10 text-center text-ink3">
                {props.emptyMessage ?? 'Sin resultados.'}
              </td>
            </tr>
          )}
          {rows.map((m) => (
            <tr
              key={m.id}
              onClick={() => props.onOpen(m.id)}
              onMouseEnter={() => props.onHover?.(m.id)}
              className={`cursor-pointer border-b border-line last:border-b-0 ${
                m.id === props.highlightedId ? 'bg-accent-soft' : 'hover:bg-inset'
              }`}
            >
              {order.map((key) => (
                <td key={key} className="px-4 py-2.5 whitespace-nowrap">
                  {cell(key, m)}
                </td>
              ))}
              <td className="px-4 py-2.5 whitespace-nowrap">
                {m.isPerito && (
                  <Chip tone="accent" icon={faIdBadge}>
                    Perito
                  </Chip>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
