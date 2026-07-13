import { useEffect, useState } from 'react'
import { api } from '../api'
import type { MemberAnnuity } from '../types'
import { annuityStatusLabels, formatMoney } from '../types'
import { useToast } from '../toast'
import { Button, Card, Chip, EmptyState, Field, Modal, Spinner, TextInput } from '../ui'

const STATUS_TONE: Record<MemberAnnuity['status'], 'good' | 'warn' | 'bad' | 'neutral'> = {
  cubierta: 'good',
  exenta: 'neutral',
  parcial: 'warn',
  pendiente: 'bad'
}

type Filter = 'todos' | 'pendientes' | 'cubiertos'

export function AnnuitiesView({ onOpenMember }: { onOpenMember: (id: string) => void }) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [rows, setRows] = useState<MemberAnnuity[] | null>(null)
  const [filter, setFilter] = useState<Filter>('todos')
  const [showFee, setShowFee] = useState(false)
  const toast = useToast()

  const load = (y: number): void => {
    setRows(null)
    api.payments
      .annuities(y)
      .then(setRows)
      .catch((e: Error) => toast(e.message, 'bad'))
  }

  useEffect(() => {
    load(year)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year])

  const feeCents = rows?.[0]?.feeCents ?? 0
  const filtered = (rows ?? []).filter((r) => {
    if (filter === 'pendientes') return r.status === 'pendiente' || r.status === 'parcial'
    if (filter === 'cubiertos') return r.status === 'cubierta' || r.status === 'exenta'
    return true
  })

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Anualidades</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear(year - 1)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink2 hover:bg-inset"
            aria-label="Año anterior"
          >
            ‹
          </button>
          <span className="text-lg font-semibold">{year}</span>
          <button
            onClick={() => setYear(year + 1)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-ink2 hover:bg-inset"
            aria-label="Año siguiente"
          >
            ›
          </button>
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-ink2">Cuota anual {year}</p>
            <p className="text-xl font-semibold">{feeCents > 0 ? formatMoney(feeCents) : 'Sin definir'}</p>
          </div>
          <Button variant="secondary" onClick={() => setShowFee(true)}>
            Editar cuota
          </Button>
        </div>
      </Card>

      <div className="my-4 flex rounded-xl bg-inset p-1">
        {(
          [
            ['todos', 'Todos'],
            ['pendientes', 'Pendientes'],
            ['cubiertos', 'Cubiertos']
          ] as Array<[Filter, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`min-h-11 flex-1 rounded-lg text-sm font-medium ${
              filter === key ? 'bg-surface text-ink shadow-sm' : 'text-ink2'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {rows === null ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState>Sin miembros en este filtro.</EmptyState>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <Card key={r.memberId} onClick={() => onOpenMember(r.memberId)}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.fullName}</p>
                  <p className="text-sm text-ink3">
                    {r.memberNumber} ·{' '}
                    {r.hasInKindSupport
                      ? 'Apoyo en especie'
                      : `${formatMoney(r.paidCents)} de ${formatMoney(r.feeCents)}`}
                  </p>
                </div>
                <Chip tone={STATUS_TONE[r.status]}>{annuityStatusLabels[r.status]}</Chip>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showFee && (
        <FeeModal
          year={year}
          currentCents={feeCents}
          onClose={() => setShowFee(false)}
          onSaved={() => {
            setShowFee(false)
            load(year)
            toast('Cuota actualizada')
          }}
        />
      )}
    </div>
  )
}

function FeeModal({
  year,
  currentCents,
  onClose,
  onSaved
}: {
  year: number
  currentCents: number
  onClose: () => void
  onSaved: () => void
}) {
  const [amount, setAmount] = useState(currentCents > 0 ? String(currentCents / 100) : '')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const submit = async (): Promise<void> => {
    setBusy(true)
    try {
      await api.payments.setFee(year, Math.round(Number(amount) * 100))
      onSaved()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'bad')
      setBusy(false)
    }
  }

  return (
    <Modal title={`Cuota anual ${year}`} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Monto (MXN)">
          <TextInput value={amount} onChange={setAmount} type="number" autoFocus />
        </Field>
        <Button onClick={() => void submit()} disabled={busy || !amount} full>
          {busy ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </Modal>
  )
}
