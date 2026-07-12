import { useEffect, useState } from 'react'
import {
  faArrowLeft,
  faCalendarPlus,
  faCheck,
  faPrint,
  faTrashCan,
  faTriangleExclamation,
  faUsers
} from '@fortawesome/free-solid-svg-icons'
import type { Assembly, AttendanceRow } from '@shared/contracts'
import { api } from '@renderer/api'
import { Button, Chip, Field, Icon, Modal, SortableTh, TextInput } from '@renderer/components/ui'
import { useSort } from '@renderer/components/useSort'

function todayLocal(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function dateLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(y!, m! - 1, d!)
  return date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function AssembliesView(): React.JSX.Element {
  const [assemblies, setAssemblies] = useState<Assembly[]>([])
  const [showNew, setShowNew] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [openAssemblyId, setOpenAssemblyId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Assembly | null>(null)

  function reload(): void {
    void api.assemblies.list().then(setAssemblies)
  }
  useEffect(reload, [])

  async function printBlank(): Promise<void> {
    setPrinting(true)
    setNotice(null)
    try {
      const result = await api.assemblies.printBlankSheet()
      setNotice(result.saved ? `Formato guardado en ${result.path}` : 'Se canceló la exportación.')
    } finally {
      setPrinting(false)
    }
  }

  async function remove(): Promise<void> {
    if (!deleting) return
    await api.assemblies.remove({ id: deleting.id })
    setDeleting(null)
    reload()
  }

  if (openAssemblyId) {
    return (
      <AttendanceView
        assemblyId={openAssemblyId}
        onBack={() => {
          setOpenAssemblyId(null)
          reload()
        }}
      />
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-start gap-3 mb-5 flex-wrap">
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">Asistencias</h1>
          <p className="text-[13px] text-ink3 mt-0.5">
            {assemblies.length} asamblea{assemblies.length === 1 ? '' : 's'} registrada{assemblies.length === 1 ? '' : 's'}
          </p>
        </div>
        <Button icon={faPrint} disabled={printing} onClick={() => void printBlank()}>
          {printing ? 'Generando…' : 'Generar Lista de Asistencia'}
        </Button>
        <Button variant="primary" icon={faCalendarPlus} onClick={() => setShowNew(true)}>
          Nueva Asamblea
        </Button>
      </div>

      {notice && <p className="text-[13px] text-good bg-good-bg rounded-lg px-3 py-2 mb-4">{notice}</p>}

      <div className="border border-line rounded-xl bg-surface divide-y divide-line">
        {assemblies.length === 0 && (
          <p className="px-4 py-10 text-center text-[13px] text-ink3">
            Aún no hay asambleas registradas — crea la primera con "Nueva Asamblea".
          </p>
        )}
        {assemblies.map((a) => (
          <div
            key={a.id}
            onClick={() => setOpenAssemblyId(a.id)}
            className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-inset"
          >
            <div className="flex-1 min-w-[200px]">
              <div className="text-[14px] font-medium capitalize">{a.title || dateLabel(a.date)}</div>
              {a.title && <div className="text-[12.5px] text-ink3 capitalize">{dateLabel(a.date)}</div>}
            </div>
            <Chip tone="accent" icon={faUsers}>
              {a.presentCount} presentes
            </Chip>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setDeleting(a)
              }}
              title="Eliminar asamblea"
              className="text-ink3 hover:text-bad p-1.5 rounded-lg hover:bg-bad-bg"
            >
              <Icon icon={faTrashCan} className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {showNew && (
        <NewAssemblyModal
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false)
            reload()
          }}
        />
      )}

      {deleting && (
        <Modal
          title="¿Eliminar asamblea?"
          subtitle="Se manda a la papelera junto con su registro de asistencia. Esta acción no se puede deshacer desde aquí."
          onClose={() => setDeleting(null)}
          footer={
            <>
              <Button onClick={() => setDeleting(null)}>Cancelar</Button>
              <Button variant="danger" icon={faTriangleExclamation} onClick={() => void remove()}>
                Sí, eliminar
              </Button>
            </>
          }
        >
          <span />
        </Modal>
      )}
    </div>
  )
}

export function NewAssemblyModal(props: { onClose: () => void; onCreated: () => void }): React.JSX.Element {
  const [date, setDate] = useState(todayLocal())
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(): Promise<void> {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await api.assemblies.create({ date, title: title.trim() || null })
      props.onCreated()
    } catch {
      setError('No se pudo crear la asamblea.')
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Nueva asamblea"
      subtitle="Fecha de hoy por defecto — ajústala si la reunión es otro día"
      onClose={props.onClose}
      footer={
        <>
          <Button onClick={props.onClose}>Cancelar</Button>
          <Button variant="primary" icon={faCheck} disabled={busy || !date} onClick={() => void save()}>
            Crear
          </Button>
        </>
      }
    >
      <Field label="Fecha">
        <TextInput type="date" value={date} onChange={setDate} />
      </Field>
      <Field label="Título" hint="Opcional, ej. 'Asamblea General Julio 2026'">
        <TextInput value={title} onChange={setTitle} placeholder="Asamblea General…" />
      </Field>
      {error && <p className="text-[13px] text-bad bg-bad-bg rounded-lg px-3 py-2">{error}</p>}
    </Modal>
  )
}

type ColKey = 'memberNumber' | 'title' | 'apellidos' | 'givenNames' | 'present'

const COLUMN_LABELS: Record<ColKey, string> = {
  memberNumber: 'No.',
  title: 'Título',
  apellidos: 'Apellidos',
  givenNames: 'Nombres',
  present: 'Asistencia'
}
const ORDER: ColKey[] = ['memberNumber', 'title', 'apellidos', 'givenNames', 'present']

function AttendanceView(props: { assemblyId: string; onBack: () => void }): React.JSX.Element {
  const [assembly, setAssembly] = useState<Assembly | null>(null)
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [printing, setPrinting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  function reload(): void {
    void api.assemblies.getAttendance({ assemblyId: props.assemblyId }).then((r) => {
      setAssembly(r.assembly)
      setRows(r.rows)
    })
  }
  useEffect(reload, [props.assemblyId])

  async function printAttendance(): Promise<void> {
    setPrinting(true)
    setNotice(null)
    try {
      const result = await api.assemblies.printAttendanceSheet({ assemblyId: props.assemblyId })
      setNotice(result.saved ? `Lista guardada en ${result.path}` : 'Se canceló la exportación.')
    } finally {
      setPrinting(false)
    }
  }

  async function toggle(row: AttendanceRow): Promise<void> {
    const next = !row.present
    setRows((prev) => prev.map((r) => (r.memberId === row.memberId ? { ...r, present: next } : r)))
    await api.assemblies.setAttendance({ assemblyId: props.assemblyId, memberId: row.memberId, present: next })
    reload()
  }

  const sort = useSort<ColKey>('memberNumber')
  const sorted = sort.sorted(rows, {
    memberNumber: (r) => r.memberNumber,
    title: (r) => r.title,
    apellidos: (r) => r.apellidos,
    givenNames: (r) => r.givenNames,
    present: (r) => (r.present ? 1 : 0)
  })
  const presentCount = rows.filter((r) => r.present).length

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <button onClick={props.onBack} className="flex items-center gap-1.5 text-[12.5px] text-ink3 hover:text-ink mb-4">
        <Icon icon={faArrowLeft} className="w-3 h-3" />
        Asistencias
      </button>

      <div className="mb-5 flex items-start gap-3 flex-wrap">
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight capitalize">
            {assembly?.title || (assembly ? dateLabel(assembly.date) : 'Cargando…')}
          </h1>
          <p className="text-[13px] text-ink3 mt-0.5">
            {assembly && assembly.title ? <span className="capitalize">{dateLabel(assembly.date)} · </span> : null}
            {presentCount} de {rows.length} presentes
          </p>
        </div>
        <Button icon={faPrint} disabled={printing} onClick={() => void printAttendance()}>
          {printing ? 'Generando…' : 'Imprimir Asistencias'}
        </Button>
      </div>

      {notice && <p className="text-[13px] text-good bg-good-bg rounded-lg px-3 py-2 mb-4">{notice}</p>}

      <div className="border border-line rounded-xl bg-surface overflow-x-auto">
        <table className="w-full text-[13.5px] min-w-[640px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-ink3">
              {ORDER.map((key) => (
                <SortableTh
                  key={key}
                  label={COLUMN_LABELS[key]}
                  sortKey={key}
                  activeKey={sort.key}
                  dir={sort.dir}
                  onClick={(k) => sort.toggle(k as ColKey)}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.memberId} className="border-b border-line last:border-b-0 hover:bg-inset">
                <td className="px-4 py-2.5 whitespace-nowrap tabular-nums text-ink2">{r.memberNumber}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{r.title ?? '—'}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{r.apellidos ?? '—'}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{r.givenNames}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <button
                    onClick={() => void toggle(r)}
                    className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-[12.5px] font-semibold ${
                      r.present ? 'bg-good-bg text-good border-good/30' : 'bg-inset text-ink3 border-line'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                        r.present ? 'bg-good border-good' : 'bg-surface border-line'
                      }`}
                    >
                      {r.present && <Icon icon={faCheck} className="w-2.5 h-2.5 text-white" />}
                    </span>
                    {r.present ? 'Presente' : 'No Presente'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
