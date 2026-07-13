import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Assembly, AttendanceRow } from '../types'
import { formatDate } from '../types'
import { useToast } from '../toast'
import { Button, Card, EmptyState, Field, Modal, Spinner, TextInput } from '../ui'

export function AssembliesView() {
  const [assemblies, setAssemblies] = useState<Assembly[] | null>(null)
  const [open, setOpen] = useState<Assembly | null>(null)
  const [showNew, setShowNew] = useState(false)
  const toast = useToast()

  const load = (): void => {
    api.assemblies
      .list()
      .then(setAssemblies)
      .catch((e: Error) => toast(e.message, 'bad'))
  }

  useEffect(load, [])

  if (open) {
    return (
      <AttendanceDetail
        assembly={open}
        onBack={() => {
          setOpen(null)
          load()
        }}
      />
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Asistencias</h1>
        <Button onClick={() => setShowNew(true)}>+ Nueva asamblea</Button>
      </div>

      {assemblies === null ? (
        <Spinner />
      ) : assemblies.length === 0 ? (
        <EmptyState>Aún no hay asambleas registradas.</EmptyState>
      ) : (
        <div className="space-y-2">
          {assemblies.map((a) => (
            <Card key={a.id} onClick={() => setOpen(a)}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{a.title ?? 'Asamblea General'}</p>
                  <p className="text-sm text-ink3">{formatDate(a.date)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent">
                  {a.presentCount} presentes
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showNew && (
        <NewAssemblyModal
          onClose={() => setShowNew(false)}
          onCreated={(a) => {
            setShowNew(false)
            toast('Asamblea creada')
            setOpen(a)
          }}
        />
      )}
    </div>
  )
}

function NewAssemblyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (a: Assembly) => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const submit = async (): Promise<void> => {
    setBusy(true)
    try {
      const a = await api.assemblies.create({ date, title: title.trim() || null })
      onCreated(a)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo crear', 'bad')
      setBusy(false)
    }
  }

  return (
    <Modal title="Nueva asamblea" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Fecha">
          <TextInput value={date} onChange={setDate} type="date" />
        </Field>
        <Field label="Título (opcional)">
          <TextInput value={title} onChange={setTitle} placeholder="Asamblea General" />
        </Field>
        <Button onClick={() => void submit()} disabled={busy || !date} full>
          {busy ? 'Creando…' : 'Crear asamblea'}
        </Button>
      </div>
    </Modal>
  )
}

function AttendanceDetail({ assembly, onBack }: { assembly: Assembly; onBack: () => void }) {
  const [rows, setRows] = useState<AttendanceRow[] | null>(null)
  const toast = useToast()

  useEffect(() => {
    api.assemblies
      .attendance(assembly.id)
      .then(setRows)
      .catch((e: Error) => toast(e.message, 'bad'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assembly.id])

  const toggle = (memberId: string, present: boolean): void => {
    // Actualización optimista, igual que el drag del calendario en escritorio.
    setRows((prev) => prev?.map((r) => (r.memberId === memberId ? { ...r, present } : r)) ?? null)
    api.assemblies.setAttendance(assembly.id, memberId, present).catch((e: Error) => {
      toast(e.message, 'bad')
      setRows((prev) => prev?.map((r) => (r.memberId === memberId ? { ...r, present: !present } : r)) ?? null)
    })
  }

  const presentCount = rows?.filter((r) => r.present).length ?? 0

  return (
    <div>
      <button onClick={onBack} className="mb-3 flex min-h-11 items-center gap-1 text-accent">
        ← Asistencias
      </button>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">{assembly.title ?? 'Asamblea General'}</h1>
        <p className="text-ink3">
          {formatDate(assembly.date)} · {presentCount} de {rows?.length ?? '…'} presentes
        </p>
      </div>

      {rows === null ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState>No hay miembros activos.</EmptyState>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.memberId}>
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {[r.title, r.givenNames, r.apellidos].filter(Boolean).join(' ')}
                  </p>
                  <p className="text-sm text-ink3">{r.memberNumber}</p>
                </div>
                <button
                  onClick={() => toggle(r.memberId, !r.present)}
                  className={`min-h-11 shrink-0 rounded-full px-4 font-medium ${
                    r.present ? 'bg-good-bg text-good' : 'bg-inset text-ink3'
                  }`}
                >
                  {r.present ? '✓ Presente' : 'Ausente'}
                </button>
              </label>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
