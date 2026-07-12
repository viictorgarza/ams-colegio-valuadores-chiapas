import { useEffect, useState } from 'react'
import {
  faCoins,
  faDownload,
  faEye,
  faHandHoldingHeart,
  faMoneyCheckDollar,
  faReceipt,
  faTrashCan
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { MemberDetail, Payment } from '@shared/contracts'
import { api } from '@renderer/api'
import { Button, Chip, Field, Icon, Modal, TextInput } from '@renderer/components/ui'

const KIND_LABEL: Record<string, string> = {
  pago: 'Pago',
  apoyo_en_especie: 'Apoyo en especie',
  condonacion: 'Condonación'
}

const KIND_ICON: Record<Payment['kind'], IconDefinition> = {
  pago: faCoins,
  apoyo_en_especie: faHandHoldingHeart,
  condonacion: faReceipt
}

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
}

export function PaymentsTab(props: { member: MemberDetail }): React.JSX.Element {
  const [payments, setPayments] = useState<Payment[]>([])
  const [showNew, setShowNew] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  function reload(): void {
    void api.payments.listByMember({ memberId: props.member.id }).then(setPayments)
  }
  useEffect(reload, [props.member.id])

  return (
    <div className="max-w-2xl">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-[13px] font-semibold text-ink2">Historial de pagos</h2>
        <Button variant="primary" icon={faMoneyCheckDollar} onClick={() => setShowNew(true)}>
          Registrar pago
        </Button>
      </div>

      {notice && (
        <p className="text-[13px] text-good bg-good-bg rounded-lg px-3 py-2 mb-3">{notice}</p>
      )}

      {payments.length === 0 ? (
        <p className="text-[13px] text-ink3">Sin pagos registrados todavía.</p>
      ) : (
        <div className="border border-line rounded-xl bg-surface divide-y divide-line">
          {payments.map((p) => (
            <div key={p.id} className="px-4 py-3 flex items-center gap-3 text-[13.5px]">
              <Chip tone={p.kind === 'pago' ? 'good' : 'accent'} icon={KIND_ICON[p.kind]}>
                {KIND_LABEL[p.kind]}
              </Chip>
              <span className="text-ink2">{p.year}</span>
              <span className="flex-1 font-semibold tabular-nums">{money(p.amountCents)}</span>
              {p.receiptFolio && <span className="text-xs text-ink3">{p.receiptFolio}</span>}
              <span className="text-ink3 text-xs tabular-nums w-24 text-right">{p.paidAt}</span>
              {p.receiptFolio && (
                <>
                  <button
                    onClick={() => void api.payments.openReceipt({ id: p.id })}
                    className="flex items-center gap-1.5 text-xs text-ink3 hover:text-accent"
                  >
                    <Icon icon={faEye} className="w-3 h-3" />
                    Ver recibo
                  </button>
                  <button
                    onClick={() =>
                      void api.payments
                        .downloadReceipt({ id: p.id })
                        .then((r) => r.path && setNotice(`Recibo guardado en ${r.path}`))
                    }
                    className="flex items-center gap-1.5 text-xs text-ink3 hover:text-accent"
                  >
                    <Icon icon={faDownload} className="w-3 h-3" />
                    Descargar
                  </button>
                </>
              )}
              <button
                onClick={() => void api.payments.remove({ id: p.id }).then(reload)}
                className="flex items-center gap-1.5 text-xs text-ink3 hover:text-bad"
              >
                <Icon icon={faTrashCan} className="w-3 h-3" />
                Papelera
              </button>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <NewPaymentModal
          member={props.member}
          onClose={() => setShowNew(false)}
          onCreated={(path) => {
            setShowNew(false)
            reload()
            setNotice(path ? `Recibo guardado en ${path}` : 'Registrado correctamente')
          }}
        />
      )}
    </div>
  )
}

export type PaymentMemberRef = { id: string; fullName: string; memberNumber: string }

export function NewPaymentModal(props: {
  member: PaymentMemberRef
  onClose: () => void
  onCreated: (receiptPath: string | null) => void
}): React.JSX.Element {
  const year = new Date().getFullYear()
  const [fee, setFee] = useState<number | null>(null)
  const [concept, setConcept] = useState<'cuota_anual' | 'otro'>('cuota_anual')
  const [otroConcepto, setOtroConcepto] = useState('')
  const [kind, setKind] = useState<'pago' | 'apoyo_en_especie' | 'condonacion'>('pago')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'efectivo' | 'transferencia' | 'otro'>('efectivo')
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (concept !== 'cuota_anual') return
    void api.payments.getAnnualFee({ year }).then((f) => {
      setFee(f?.amountCents ?? null)
      if (f) setAmount((f.amountCents / 100).toFixed(2))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concept])

  async function save(): Promise<void> {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const amountCents = kind === 'pago' ? Math.round(parseFloat(amount || '0') * 100) : 0
      const result = await api.payments.create({
        memberId: props.member.id,
        year,
        kind,
        amountCents,
        paidAt: new Date().toISOString().slice(0, 10),
        method: kind === 'pago' ? method : null,
        concept: concept === 'otro' ? otroConcepto.trim() || 'Otro' : null,
        reference: reference.trim() || null
      })
      props.onCreated(result.receiptPath)
    } catch {
      setError('No se pudo registrar el pago.')
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Registrar pago"
      subtitle={`${props.member.fullName} · ${props.member.memberNumber}`}
      onClose={props.onClose}
      footer={
        <>
          <Button onClick={props.onClose}>Cancelar</Button>
          <Button variant="primary" icon={faReceipt} onClick={() => void save()} disabled={busy}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="flex gap-2">
        <button
          onClick={() => setConcept('cuota_anual')}
          className={
            concept === 'cuota_anual'
              ? 'px-3.5 py-1.5 rounded-lg bg-accent-soft border border-accent text-accent text-[13px] font-semibold'
              : 'px-3.5 py-1.5 rounded-lg border border-line text-ink2 text-[13px] hover:bg-inset'
          }
        >
          Cuota {year} {fee !== null && concept === 'cuota_anual' ? `· ${money(fee)}` : ''}
        </button>
        <button
          onClick={() => setConcept('otro')}
          className={
            concept === 'otro'
              ? 'px-3.5 py-1.5 rounded-lg bg-accent-soft border border-accent text-accent text-[13px] font-semibold'
              : 'px-3.5 py-1.5 rounded-lg border border-line text-ink2 text-[13px] hover:bg-inset'
          }
        >
          Otro
        </button>
      </div>

      {concept === 'otro' && (
        <Field label="Concepto" hint="¿De qué es este pago?">
          <TextInput value={otroConcepto} onChange={setOtroConcepto} placeholder="Curso, credencial, etc." autoFocus />
        </Field>
      )}

      <div className="flex gap-2">
        {(['pago', 'apoyo_en_especie', 'condonacion'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={
              k === kind
                ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-soft border border-accent text-accent text-[13px] font-semibold'
                : 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-ink2 text-[13px] hover:bg-inset'
            }
          >
            <Icon icon={KIND_ICON[k]} className="w-3.5 h-3.5" />
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {kind === 'pago' && (
        <>
          <Field label="Monto">
            <TextInput value={amount} onChange={setAmount} placeholder="1500.00" />
          </Field>
          <div className="flex gap-2">
            {(['efectivo', 'transferencia', 'otro'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={
                  m === method
                    ? 'px-3 py-1.5 rounded-lg bg-accent-soft border border-accent text-accent text-[13px] font-semibold'
                    : 'px-3 py-1.5 rounded-lg border border-line text-ink2 text-[13px] hover:bg-inset'
                }
              >
                {m[0]!.toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          <Field label="Referencia" hint="opcional">
            <TextInput value={reference} onChange={setReference} />
          </Field>
        </>
      )}

      {error && <p className="text-[13px] text-bad bg-bad-bg rounded-lg px-3 py-2">{error}</p>}
    </Modal>
  )
}
