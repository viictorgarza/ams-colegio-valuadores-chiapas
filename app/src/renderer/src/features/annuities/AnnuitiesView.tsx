import { useEffect, useState } from 'react'
import {
  faCheckCircle,
  faCircleExclamation,
  faClockRotateLeft,
  faFloppyDisk,
  faMoneyCheckDollar,
  faShieldHeart
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { MemberAnnuity } from '@shared/contracts'
import { api } from '@renderer/api'
import { Button, Chip, Field, Icon, SortableTh, TextInput } from '@renderer/components/ui'
import { useSort } from '@renderer/components/useSort'
import { useColumnOrder } from '@renderer/components/useColumnOrder'
import { NewPaymentQuickModal } from '@renderer/app/NewPaymentQuickModal'

const STATUS_TONE = {
  exenta: 'muted',
  cubierta: 'good',
  parcial: 'warn',
  pendiente: 'muted'
} as const

const STATUS_ICON: Record<string, IconDefinition> = {
  exenta: faShieldHeart,
  cubierta: faCheckCircle,
  parcial: faCircleExclamation,
  pendiente: faClockRotateLeft
}

const STATUS_LABEL: Record<string, string> = {
  exenta: 'Exenta',
  cubierta: 'Cubierta',
  parcial: 'Parcial',
  pendiente: 'Pendiente'
}

type ColKey = 'memberNumber' | 'title' | 'apellidos' | 'givenNames' | 'phone' | 'status'

const COLUMN_LABELS: Record<ColKey, string> = {
  memberNumber: 'No.',
  title: 'Título',
  apellidos: 'Apellidos',
  givenNames: 'Nombres',
  phone: 'Celular',
  status: 'Estado'
}
const DEFAULT_ORDER: ColKey[] = ['memberNumber', 'title', 'apellidos', 'givenNames', 'phone', 'status']

function cell(key: ColKey, m: MemberAnnuity): React.ReactNode {
  if (key === 'memberNumber') return <span className="tabular-nums text-ink2">{m.memberNumber}</span>
  if (key === 'title') return m.title ?? '—'
  if (key === 'apellidos') return m.apellidos ?? '—'
  if (key === 'givenNames') return m.givenNames
  if (key === 'phone') return <span className="tabular-nums text-ink2">{m.phone ?? '—'}</span>
  return (
    <Chip tone={STATUS_TONE[m.status]} icon={STATUS_ICON[m.status]}>
      {STATUS_LABEL[m.status]}
      {m.hasInKindSupport ? ' (apoyo)' : ''}
    </Chip>
  )
}

type StatusFilter = 'todos' | MemberAnnuity['status']

const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'todos', label: 'Todos' },
  { key: 'cubierta', label: 'Cubiertas' },
  { key: 'parcial', label: 'Parciales' },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'exenta', label: 'Exentas' }
]

export function AnnuitiesView(props: {
  onOpenMember: (id: string) => void
  initialStatusFilter?: 'pendiente'
}): React.JSX.Element {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [items, setItems] = useState<MemberAnnuity[]>([])
  const [fee, setFee] = useState('')
  const [feeSaved, setFeeSaved] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(props.initialStatusFilter ?? 'todos')
  const [showNewPayment, setShowNewPayment] = useState(false)

  function reload(): void {
    void api.payments.annuitiesByYear({ year }).then(setItems)
    void api.payments.getAnnualFee({ year }).then((f) => setFee(f ? (f.amountCents / 100).toFixed(2) : ''))
  }
  useEffect(reload, [year])

  async function saveFee(): Promise<void> {
    const amountCents = Math.round(parseFloat(fee || '0') * 100)
    await api.payments.setAnnualFee({ year, amountCents })
    setFeeSaved(true)
    reload()
  }

  const covered = items.filter((i) => i.status === 'cubierta' || i.status === 'exenta').length
  const filteredItems = statusFilter === 'todos' ? items : items.filter((i) => i.status === statusFilter)

  const sort = useSort<ColKey>('memberNumber')
  const rows = sort.sorted(filteredItems, {
    memberNumber: (m) => m.memberNumber,
    title: (m) => m.title,
    apellidos: (m) => m.apellidos,
    givenNames: (m) => m.givenNames,
    phone: (m) => m.phone,
    status: (m) => m.status
  })
  const cols = useColumnOrder('table-cols:annuities-v3', DEFAULT_ORDER)
  const order = cols.order as ColKey[]

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-start gap-4 mb-5 flex-wrap">
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">Anualidades {year}</h1>
          <p className="text-[13px] text-ink3 mt-0.5">
            {covered} de {items.length} cubiertas
          </p>
        </div>
        <div className="flex gap-1.5">
          {[currentYear - 1, currentYear].map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={
                y === year
                  ? 'px-3.5 py-1.5 rounded-lg bg-accent text-on-accent text-[13px] font-semibold'
                  : 'px-3.5 py-1.5 rounded-lg border border-line text-ink2 text-[13px] hover:bg-inset'
              }
            >
              {y}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <Field label={`Cuota general ${year}`}>
            <TextInput
              value={fee}
              onChange={(v) => {
                setFee(v)
                setFeeSaved(false)
              }}
              placeholder="1500.00"
            />
          </Field>
          <button
            onClick={() => void saveFee()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-[13px] text-ink2 hover:bg-inset mb-[1px]"
          >
            <Icon icon={faFloppyDisk} className="w-3.5 h-3.5" />
            Guardar
          </button>
        </div>
        <div className="self-end mb-[1px]">
          <Button variant="primary" icon={faMoneyCheckDollar} onClick={() => setShowNewPayment(true)}>
            Nuevo Pago
          </Button>
        </div>
      </div>
      {feeSaved && <p className="text-[13px] text-good mb-3">Cuota guardada ✓</p>}

      <div className="flex gap-1.5 mb-3">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={
              f.key === statusFilter
                ? 'px-3 py-1.5 rounded-lg bg-accent text-on-accent text-[12.5px] font-semibold'
                : 'px-3 py-1.5 rounded-lg border border-line text-ink2 text-[12.5px] hover:bg-inset'
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="border border-line rounded-xl bg-surface overflow-x-auto">
        <table className="w-full text-[13.5px] min-w-[600px]">
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
                  Sin resultados para este filtro.
                </td>
              </tr>
            )}
            {rows.map((m) => (
              <tr
                key={m.memberId}
                onClick={() => props.onOpenMember(m.memberId)}
                className="cursor-pointer hover:bg-inset border-b border-line last:border-b-0"
              >
                {order.map((key) => (
                  <td key={key} className="px-4 py-2.5 whitespace-nowrap">
                    {cell(key, m)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNewPayment && (
        <NewPaymentQuickModal
          onClose={() => setShowNewPayment(false)}
          onCreated={() => {
            setShowNewPayment(false)
            reload()
          }}
        />
      )}
    </div>
  )
}
