import { useEffect, useState } from 'react'
import {
  faBoxArchive,
  faCheckCircle,
  faCircleExclamation,
  faClockRotateLeft,
  faDownload,
  faEye,
  faTimesCircle,
  faTrashCan,
  faTriangleExclamation,
  faUpload,
  faWandMagicSparkles
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { MemberDetail, MemberDocumentEntry, MemberExpediente } from '@shared/contracts'
import { api } from '@renderer/api'
import { Button, Chip, Field, Icon, Modal, TextInput } from '@renderer/components/ui'

function statusChipTone(status: MemberDocumentEntry['derivedStatus']): 'good' | 'warn' | 'bad' | 'muted' {
  if (status === 'vigente') return 'good'
  if (status === 'vencido') return 'bad'
  if (status === 'rechazado') return 'bad'
  return 'muted'
}

const STATUS_ICON: Record<MemberDocumentEntry['derivedStatus'], IconDefinition> = {
  pendiente: faClockRotateLeft,
  vigente: faCheckCircle,
  rechazado: faTimesCircle,
  vencido: faCircleExclamation
}

const STATUS_LABEL: Record<MemberDocumentEntry['derivedStatus'], string> = {
  pendiente: 'Pendiente',
  vigente: 'Vigente',
  rechazado: 'Rechazado',
  vencido: 'Vencido'
}

export function DocumentsTab(props: { member: MemberDetail }): React.JSX.Element {
  const [exp, setExp] = useState<MemberExpediente | null>(null)
  const [busyTypeId, setBusyTypeId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<MemberDocumentEntry | null>(null)
  const [deleting, setDeleting] = useState<MemberDocumentEntry | null>(null)

  function reload(): void {
    void api.documents.listByMember({ memberId: props.member.id }).then(setExp)
  }
  useEffect(reload, [props.member.id])

  async function upload(entry: MemberDocumentEntry): Promise<void> {
    setBusyTypeId(entry.documentTypeId)
    setError(null)
    try {
      const updated = await api.documents.upload({ memberId: props.member.id, documentTypeId: entry.documentTypeId })
      if (updated) reload()
    } catch {
      setError('No se pudo subir el archivo. Verifica que sea JPG, PNG, HEIC o PDF.')
    } finally {
      setBusyTypeId(null)
    }
  }

  async function uploadFromPath(entry: MemberDocumentEntry, filePath: string): Promise<void> {
    setBusyTypeId(entry.documentTypeId)
    setError(null)
    try {
      await api.documents.uploadFromPath({ memberId: props.member.id, documentTypeId: entry.documentTypeId, filePath })
      reload()
    } catch {
      setError('No se pudo subir el archivo. Verifica que sea JPG, PNG, HEIC o PDF.')
    } finally {
      setBusyTypeId(null)
    }
  }

  async function remove(entry: MemberDocumentEntry): Promise<void> {
    if (!entry.memberDocumentId) return
    await api.documents.remove({ memberDocumentId: entry.memberDocumentId })
    setDeleting(null)
    reload()
  }

  if (!exp) return <p className="text-[13px] text-ink3">Cargando expediente…</p>

  const required = exp.entries.filter((e) => e.isRequired)
  const optional = exp.entries.filter((e) => !e.isRequired)
  const pct = exp.requiredTotal > 0 ? Math.round((exp.requiredCompleted / exp.requiredTotal) * 100) : 0

  return (
    <div className="max-w-3xl flex flex-col gap-6">
      <div className="bg-surface border border-line rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13.5px] font-semibold">Documentos requeridos completos</span>
          <span className="text-[13.5px] font-semibold tabular-nums">
            {exp.requiredCompleted} de {exp.requiredTotal}
          </span>
        </div>
        <div className="h-3 rounded-full bg-inset overflow-hidden">
          <div className="h-full rounded-full bg-good transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {error && <p className="text-[13px] text-bad bg-bad-bg rounded-lg px-3 py-2">{error}</p>}

      <Section title="Requeridos">
        {required.map((entry) => (
          <DocRow
            key={entry.documentTypeId}
            entry={entry}
            busy={busyTypeId === entry.documentTypeId}
            onUpload={() => void upload(entry)}
            onDropFile={(path) => void uploadFromPath(entry, path)}
            onEdit={() => setEditing(entry)}
            onDelete={() => setDeleting(entry)}
          />
        ))}
      </Section>

      <Section title="Opcionales">
        {optional.map((entry) => (
          <DocRow
            key={entry.documentTypeId}
            entry={entry}
            busy={busyTypeId === entry.documentTypeId}
            onUpload={() => void upload(entry)}
            onDropFile={(path) => void uploadFromPath(entry, path)}
            onEdit={() => setEditing(entry)}
            onDelete={() => setDeleting(entry)}
          />
        ))}
      </Section>

      {editing && (
        <DocDetailModal
          entry={editing}
          onClose={() => setEditing(null)}
          onChanged={() => {
            setEditing(null)
            reload()
          }}
        />
      )}

      {deleting && (
        <Modal
          title="¿Eliminar documento cargado?"
          subtitle={`${deleting.documentTypeName} volverá a "Pendiente" y se podrá subir de nuevo. Esta acción no se puede deshacer.`}
          onClose={() => setDeleting(null)}
          footer={
            <>
              <Button onClick={() => setDeleting(null)}>Cancelar</Button>
              <Button variant="danger" icon={faTriangleExclamation} onClick={() => void remove(deleting)}>
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

function Section(props: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink3 mb-2">{props.title}</div>
      <div className="border border-line rounded-xl bg-surface divide-y divide-line">{props.children}</div>
    </div>
  )
}

function DocRow(props: {
  entry: MemberDocumentEntry
  busy: boolean
  onUpload: () => void
  onDropFile: (filePath: string) => void
  onEdit: () => void
  onDelete: () => void
}): React.JSX.Element {
  const { entry } = props
  const latest = entry.versions[0] ?? null
  const [dragOver, setDragOver] = useState(false)

  function onDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    props.onDropFile(window.ams.getPathForFile(file))
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`px-4 py-3 flex items-center gap-3 flex-wrap transition-colors ${
        dragOver ? 'bg-accent-soft outline-dashed outline-2 outline-accent -outline-offset-4' : ''
      }`}
    >
      <div className="flex-1 min-w-[180px]">
        <div className="text-[14px] font-medium">{entry.documentTypeName}</div>
        <div className="text-[11px] text-ink3">o arrastra el archivo aquí</div>
      </div>
      <Chip tone={statusChipTone(entry.derivedStatus)} icon={STATUS_ICON[entry.derivedStatus]}>
        {STATUS_LABEL[entry.derivedStatus]}
      </Chip>
      {entry.hasExpiry && entry.expiresAt && <span className="text-xs text-ink3">Vence {entry.expiresAt}</span>}
      {entry.hasPhysical && (
        <Chip tone="accent" icon={faBoxArchive}>
          Físico
        </Chip>
      )}
      {entry.versions.length > 1 && (
        <span className="text-xs text-ink3">{entry.versions.length} versiones</span>
      )}

      <div className="flex items-center gap-2 ml-auto">
        {latest && (
          <>
            <Button icon={faEye} onClick={() => void api.documents.openVersion({ versionId: latest.id })}>
              Ver
            </Button>
            <Button icon={faDownload} onClick={() => void api.documents.downloadVersion({ versionId: latest.id })}>
              Descargar
            </Button>
          </>
        )}
        <Button variant="primary" icon={faUpload} disabled={props.busy} onClick={props.onUpload}>
          {latest ? 'Reemplazar' : 'Subir'}
        </Button>
        {entry.memberDocumentId && <Button onClick={props.onEdit}>Detalles</Button>}
        {latest && (
          <Button variant="danger" icon={faTrashCan} onClick={props.onDelete} title="Eliminar documento cargado">
            Eliminar
          </Button>
        )}
      </div>
    </div>
  )
}

function DocDetailModal(props: {
  entry: MemberDocumentEntry
  onClose: () => void
  onChanged: () => void
}): React.JSX.Element {
  const { entry } = props
  const [status, setStatus] = useState(entry.status)
  const [issuedAt, setIssuedAt] = useState(entry.issuedAt ?? '')
  const [expiresAt, setExpiresAt] = useState(entry.expiresAt ?? '')
  const [hasPhysical, setHasPhysical] = useState(entry.hasPhysical)
  const [physicalLocation, setPhysicalLocation] = useState(entry.physicalLocation ?? '')
  const [notes, setNotes] = useState(entry.notes ?? '')
  const [detecting, setDetecting] = useState(false)
  const [detectMessage, setDetectMessage] = useState<string | null>(null)

  async function detectWithAi(): Promise<void> {
    const versionId = entry.versions[0]?.id
    if (!versionId) return
    setDetecting(true)
    setDetectMessage(null)
    try {
      const result = await api.documents.detectExpiry({ versionId })
      if (!result.ok) {
        setDetectMessage(result.error ?? 'No se pudo detectar la fecha.')
      } else if (result.candidateDate) {
        setExpiresAt(result.candidateDate)
        setDetectMessage(`Detectado: ${result.candidateDate} — verifica antes de guardar.`)
      } else {
        setDetectMessage('No se encontró una fecha en la foto. Captúrala a mano.')
      }
    } finally {
      setDetecting(false)
    }
  }

  async function save(): Promise<void> {
    const id = entry.memberDocumentId!
    if (status !== entry.status) await api.documents.setStatus({ memberDocumentId: id, status })
    if (entry.hasExpiry && issuedAt !== (entry.issuedAt ?? '')) {
      await api.documents.setIssuedAt({ memberDocumentId: id, issuedAt: issuedAt.trim() || null })
    }
    if (entry.hasExpiry && expiresAt !== (entry.expiresAt ?? '')) {
      await api.documents.setExpiry({ memberDocumentId: id, expiresAt: expiresAt.trim() || null })
    }
    if (hasPhysical !== entry.hasPhysical || physicalLocation !== (entry.physicalLocation ?? '')) {
      await api.documents.setPhysical({
        memberDocumentId: id,
        hasPhysical,
        physicalLocation: hasPhysical ? physicalLocation.trim() || null : null
      })
    }
    if (notes !== (entry.notes ?? '')) {
      await api.documents.setNotes({ memberDocumentId: id, notes: notes.trim() || null })
    }
    props.onChanged()
  }

  return (
    <Modal
      title={entry.documentTypeName}
      subtitle="Estado, vencimiento y resguardo físico"
      onClose={props.onClose}
      footer={
        <>
          <Button onClick={props.onClose}>Cancelar</Button>
          <Button variant="primary" icon={faCheckCircle} onClick={() => void save()}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="flex gap-2">
        {(['pendiente', 'vigente', 'rechazado'] as const).map((st) => (
          <button
            key={st}
            onClick={() => setStatus(st)}
            className={
              st === status
                ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-soft border border-accent text-accent text-[13px] font-semibold'
                : 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-ink2 text-[13px] hover:bg-inset'
            }
          >
            <Icon icon={STATUS_ICON[st]} className="w-3 h-3" />
            {STATUS_LABEL[st]}
          </button>
        ))}
      </div>

      {entry.hasExpiry && (
        <>
          <Field
            label="Fecha de emisión"
            hint={
              entry.validityMonths
                ? `Calcula la vigencia sola (${entry.validityMonths} meses)`
                : 'Opcional, para referencia'
            }
          >
            <TextInput type="date" value={issuedAt} onChange={setIssuedAt} />
          </Field>
          <Field label="Fecha de vencimiento" hint="Se puede ajustar a mano si hace falta">
            <div className="flex items-center gap-2">
              <TextInput type="date" value={expiresAt} onChange={setExpiresAt} />
              {entry.versions.length > 0 && (
                <Button icon={faWandMagicSparkles} disabled={detecting} onClick={() => void detectWithAi()}>
                  {detecting ? 'Detectando…' : 'Detectar con IA'}
                </Button>
              )}
            </div>
          </Field>
          {detectMessage && <p className="text-[12.5px] text-ink3">{detectMessage}</p>}
        </>
      )}

      <label className="flex items-center gap-2 text-[13.5px]">
        <input
          type="checkbox"
          checked={hasPhysical}
          onChange={(e) => setHasPhysical(e.target.checked)}
          className="w-4 h-4 accent-[#163eab]"
        />
        Se conserva copia física
      </label>
      {hasPhysical && (
        <Field label="Ubicación">
          <TextInput
            value={physicalLocation}
            onChange={setPhysicalLocation}
            placeholder="Archivero, gaveta 2"
          />
        </Field>
      )}

      <Field label="Notas" hint="Visible solo en el expediente, opcional">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="border border-line rounded-lg px-3 py-2 bg-surface text-[13.5px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft w-full"
        />
      </Field>
    </Modal>
  )
}
