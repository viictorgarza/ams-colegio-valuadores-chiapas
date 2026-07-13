import { useEffect, useState } from 'react'
import { api } from '../api'
import type { MemberDetail, Payment, StatusHistoryEntry } from '../types'
import { formatDateShort, formatMoney } from '../types'
import { useToast } from '../toast'
import { Button, Card, Chip, EmptyState, Field, Modal, Select, Spinner, TextArea, TextInput } from '../ui'

const STATUS_OPTIONS = [
  { value: 'activo', label: 'Activo' },
  { value: 'suspendido', label: 'Suspendido' },
  { value: 'inactivo', label: 'Inactivo' },
  { value: 'fallecido', label: 'Fallecido' }
]

const KIND_LABELS: Record<Payment['kind'], string> = {
  pago: 'Pago',
  apoyo_en_especie: 'Apoyo en especie',
  condonacion: 'Condonación'
}

type Tab = 'info' | 'pagos' | 'historial'

export function MemberDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const [member, setMember] = useState<MemberDetail | null>(null)
  const [payments, setPayments] = useState<Payment[] | null>(null)
  const [history, setHistory] = useState<StatusHistoryEntry[] | null>(null)
  const [tab, setTab] = useState<Tab>('info')
  const [editing, setEditing] = useState(false)
  const [showStatus, setShowStatus] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const toast = useToast()

  const reload = (): void => {
    api.members
      .get(id)
      .then(setMember)
      .catch((e: Error) => toast(e.message, 'bad'))
  }

  useEffect(() => {
    reload()
    api.members.payments(id).then(setPayments).catch(() => setPayments([]))
    api.members.history(id).then(setHistory).catch(() => setHistory([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!member) return <Spinner />

  return (
    <div>
      <button onClick={onBack} className="mb-3 flex min-h-11 items-center gap-1 text-accent">
        ← Miembros
      </button>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{member.fullName}</h1>
          <p className="text-ink3">
            {member.memberNumber} · {member.membershipTypeName}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowStatus(true)}>
            {member.statusName}
          </Button>
          <Button onClick={() => setShowPayment(true)}>+ Pago</Button>
        </div>
      </div>

      <div className="mb-5 flex rounded-xl bg-inset p-1">
        {(
          [
            ['info', 'Información'],
            ['pagos', 'Pagos'],
            ['historial', 'Historial']
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`min-h-11 flex-1 rounded-lg text-sm font-medium ${
              tab === key ? 'bg-surface text-ink shadow-sm' : 'text-ink2'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'info' &&
        (editing ? (
          <InfoForm
            member={member}
            onSaved={(m) => {
              setMember(m)
              setEditing(false)
              toast('Cambios guardados')
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <InfoDisplay member={member} onEdit={() => setEditing(true)} />
        ))}

      {tab === 'pagos' &&
        (payments === null ? (
          <Spinner />
        ) : payments.length === 0 ? (
          <EmptyState>Sin pagos registrados.</EmptyState>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <Card key={p.id}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {p.concept ?? `Anualidad ${p.year}`} · {formatMoney(p.amountCents)}
                    </p>
                    <p className="text-sm text-ink3">
                      {formatDateShort(p.paidAt)} · {KIND_LABELS[p.kind]}
                      {p.receiptFolio && ` · Folio ${p.receiptFolio}`}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ))}

      {tab === 'historial' &&
        (history === null ? (
          <Spinner />
        ) : history.length === 0 ? (
          <EmptyState>Sin cambios de estado.</EmptyState>
        ) : (
          <div className="space-y-2">
            {history.map((h, i) => (
              <Card key={i}>
                <p className="font-medium">{h.statusName}</p>
                <p className="text-sm text-ink3">
                  {formatDateShort(h.changedAt)}
                  {h.changedByName && ` · por ${h.changedByName}`}
                  {h.reason && ` · ${h.reason}`}
                </p>
              </Card>
            ))}
          </div>
        ))}

      {showStatus && (
        <ChangeStatusModal
          current={member.statusCode}
          onClose={() => setShowStatus(false)}
          onSave={async (code, reason) => {
            try {
              const m = await api.members.changeStatus(id, code, reason || null)
              setMember(m)
              api.members.history(id).then(setHistory).catch(() => {})
              setShowStatus(false)
              toast('Estado actualizado')
            } catch (e) {
              toast(e instanceof Error ? e.message : 'Error', 'bad')
            }
          }}
        />
      )}

      {showPayment && (
        <NewPaymentModal
          memberId={id}
          onClose={() => setShowPayment(false)}
          onCreated={() => {
            setShowPayment(false)
            api.members.payments(id).then(setPayments).catch(() => {})
            setTab('pagos')
            toast('Pago registrado')
          }}
        />
      )}
    </div>
  )
}

const INFO_FIELDS: Array<{ key: keyof MemberDetail; label: string; type?: string }> = [
  { key: 'title', label: 'Título' },
  { key: 'givenNames', label: 'Nombre(s)' },
  { key: 'paternalSurname', label: 'Apellido paterno' },
  { key: 'maternalSurname', label: 'Apellido materno' },
  { key: 'phone', label: 'Celular', type: 'tel' },
  { key: 'phoneHome', label: 'Teléfono de casa', type: 'tel' },
  { key: 'email', label: 'Correo', type: 'email' },
  { key: 'curp', label: 'CURP' },
  { key: 'rfc', label: 'RFC' },
  { key: 'street', label: 'Calle y número' },
  { key: 'zip', label: 'C.P.' },
  { key: 'city', label: 'Ciudad' },
  { key: 'state', label: 'Estado' },
  { key: 'university', label: 'Universidad' },
  { key: 'degree', label: 'Carrera' },
  { key: 'specialty', label: 'Especialidad' },
  { key: 'masters', label: 'Maestría' },
  { key: 'doctorate', label: 'Doctorado' },
  { key: 'company', label: 'Empresa' },
  { key: 'position', label: 'Cargo' },
  { key: 'peritoNumber', label: 'No. de perito' },
  { key: 'joinedAt', label: 'Fecha de ingreso', type: 'date' }
]

function InfoDisplay({ member, onEdit }: { member: MemberDetail; onEdit: () => void }) {
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="secondary" onClick={onEdit}>
          Editar
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {INFO_FIELDS.map((f) => (
          <Card key={f.key}>
            <p className="text-xs text-ink3">{f.label}</p>
            <p className="mt-0.5 min-h-6">{(member[f.key] as string | null) ?? <span className="text-ink3">—</span>}</p>
          </Card>
        ))}
        <Card>
          <p className="text-xs text-ink3">Perito valuador</p>
          <p className="mt-0.5">{member.isPerito ? 'Sí' : 'No'}</p>
        </Card>
        <Card>
          <p className="text-xs text-ink3">Observaciones</p>
          <p className="mt-0.5 min-h-6">{member.observations ?? <span className="text-ink3">—</span>}</p>
        </Card>
      </div>
    </div>
  )
}

function InfoForm({
  member,
  onSaved,
  onCancel
}: {
  member: MemberDetail
  onSaved: (m: MemberDetail) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {}
    for (const f of INFO_FIELDS) v[f.key] = (member[f.key] as string | null) ?? ''
    v['observations'] = member.observations ?? ''
    return v
  })
  const [isPerito, setIsPerito] = useState(member.isPerito)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const submit = async (): Promise<void> => {
    setBusy(true)
    try {
      const patch: Record<string, unknown> = { isPerito }
      for (const f of INFO_FIELDS) {
        const raw = values[f.key]?.trim() ?? ''
        patch[f.key] = f.key === 'givenNames' ? raw : raw || null
      }
      patch['observations'] = values['observations']?.trim() || null
      const m = await api.members.update(member.id, patch)
      onSaved(m)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar', 'bad')
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {INFO_FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            <TextInput
              value={values[f.key] ?? ''}
              onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: v }))}
              type={f.type ?? 'text'}
            />
          </Field>
        ))}
        <Field label="Perito valuador">
          <Select
            value={isPerito ? 'si' : 'no'}
            onChange={(v) => setIsPerito(v === 'si')}
            options={[
              { value: 'no', label: 'No' },
              { value: 'si', label: 'Sí' }
            ]}
          />
        </Field>
      </div>
      <div className="mt-4">
        <Field label="Observaciones">
          <TextArea value={values['observations'] ?? ''} onChange={(v) => setValues((p) => ({ ...p, observations: v }))} />
        </Field>
      </div>
      <div className="mt-5 flex gap-3">
        <Button onClick={() => void submit()} disabled={busy || !values['givenNames']?.trim()}>
          {busy ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

function ChangeStatusModal({
  current,
  onClose,
  onSave
}: {
  current: string
  onClose: () => void
  onSave: (code: string, reason: string) => Promise<void>
}) {
  const [code, setCode] = useState(current)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <Modal title="Cambiar estado" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Nuevo estado">
          <Select value={code} onChange={setCode} options={STATUS_OPTIONS} />
        </Field>
        <Field label="Motivo (opcional)">
          <TextInput value={reason} onChange={setReason} />
        </Field>
        <Button
          onClick={() => {
            setBusy(true)
            void onSave(code, reason).finally(() => setBusy(false))
          }}
          disabled={busy || code === current}
          full
        >
          {busy ? 'Guardando…' : 'Cambiar estado'}
        </Button>
      </div>
    </Modal>
  )
}

export function NewPaymentModal({
  memberId,
  onClose,
  onCreated
}: {
  memberId: string
  onClose: () => void
  onCreated: () => void
}) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(String(currentYear))
  const [kind, setKind] = useState<Payment['kind']>('pago')
  const [amount, setAmount] = useState('')
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState('efectivo')
  const [concept, setConcept] = useState('')
  const [isOther, setIsOther] = useState(false)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const submit = async (): Promise<void> => {
    setBusy(true)
    try {
      await api.payments.create({
        memberId,
        year: Number(year),
        kind,
        amountCents: Math.round(Number(amount || '0') * 100),
        paidAt,
        method: kind === 'pago' ? (method as Payment['method']) : null,
        concept: isOther && concept.trim() ? concept.trim() : null
      })
      onCreated()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo registrar el pago', 'bad')
      setBusy(false)
    }
  }

  return (
    <Modal title="Nuevo pago" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Concepto">
          <Select
            value={isOther ? 'otro' : 'anualidad'}
            onChange={(v) => setIsOther(v === 'otro')}
            options={[
              { value: 'anualidad', label: 'Cuota anual' },
              { value: 'otro', label: 'Otro' }
            ]}
          />
        </Field>
        {isOther && (
          <Field label="Descripción del concepto">
            <TextInput value={concept} onChange={setConcept} placeholder="Curso, credencial…" />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Año">
            <TextInput value={year} onChange={setYear} type="number" />
          </Field>
          <Field label="Monto (MXN)">
            <TextInput value={amount} onChange={setAmount} type="number" placeholder="0.00" />
          </Field>
        </div>
        <Field label="Tipo">
          <Select
            value={kind}
            onChange={(v) => setKind(v as Payment['kind'])}
            options={[
              { value: 'pago', label: 'Pago' },
              { value: 'apoyo_en_especie', label: 'Apoyo en especie' },
              { value: 'condonacion', label: 'Condonación' }
            ]}
          />
        </Field>
        {kind === 'pago' && (
          <Field label="Método">
            <Select
              value={method}
              onChange={setMethod}
              options={[
                { value: 'efectivo', label: 'Efectivo' },
                { value: 'transferencia', label: 'Transferencia' },
                { value: 'otro', label: 'Otro' }
              ]}
            />
          </Field>
        )}
        <Field label="Fecha de pago">
          <TextInput value={paidAt} onChange={setPaidAt} type="date" />
        </Field>
        <Button
          onClick={() => void submit()}
          disabled={busy || !year || (isOther && !concept.trim()) || (kind === 'pago' && !amount)}
          full
        >
          {busy ? 'Guardando…' : 'Registrar pago'}
        </Button>
        <p className="text-center text-xs text-ink3">
          El recibo PDF con folio se genera desde la computadora de la oficina.
        </p>
      </div>
    </Modal>
  )
}
