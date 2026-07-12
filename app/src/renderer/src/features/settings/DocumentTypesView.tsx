import { useEffect, useState } from 'react'
import { faBoxArchive, faCheckCircle, faPlus, faRotateLeft } from '@fortawesome/free-solid-svg-icons'
import type { DocumentType } from '@shared/contracts'
import { api } from '@renderer/api'
import { Button, Chip, Field, Modal, TextInput } from '@renderer/components/ui'

/** Configuración → Tipos de documento (E-09): catálogo editable. Nunca se borra
 * en definitiva — "isActive" es el equivalente de borrado lógico para este catálogo,
 * consistente con el resto del sistema (member_documents no referencia tipos borrados). */
export function DocumentTypesView(): React.JSX.Element {
  const [types, setTypes] = useState<DocumentType[]>([])
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<DocumentType | null>(null)

  function reload(): void {
    void api.documents.listTypes().then(setTypes)
  }
  useEffect(reload, [])

  async function toggleActive(t: DocumentType): Promise<void> {
    await api.documents.setTypeActive({ id: t.id, isActive: !t.isActive })
    reload()
  }

  const active = types.filter((t) => t.isActive)
  const inactive = types.filter((t) => !t.isActive)

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-start gap-3 mb-5">
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">Configuración</h1>
          <p className="text-[13px] text-ink3 mt-0.5">Tipos de documento del expediente</p>
        </div>
        <Button variant="primary" icon={faPlus} onClick={() => setShowNew(true)}>
          Nuevo tipo
        </Button>
      </div>

      <Section title="Activos">
        {active.map((t) => (
          <TypeRow key={t.id} type={t} onEdit={() => setEditing(t)} onToggle={() => void toggleActive(t)} />
        ))}
        {active.length === 0 && <p className="px-4 py-6 text-[13px] text-ink3">Sin tipos activos.</p>}
      </Section>

      {inactive.length > 0 && (
        <div className="mt-6">
          <Section title="Archivados">
            {inactive.map((t) => (
              <TypeRow key={t.id} type={t} onEdit={() => setEditing(t)} onToggle={() => void toggleActive(t)} />
            ))}
          </Section>
        </div>
      )}

      {showNew && (
        <TypeFormModal
          title="Nuevo tipo de documento"
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false)
            reload()
          }}
        />
      )}
      {editing && (
        <TypeFormModal
          title="Editar tipo de documento"
          type={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
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

function TypeRow(props: { type: DocumentType; onEdit: () => void; onToggle: () => void }): React.JSX.Element {
  const { type } = props
  return (
    <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
      <span className="text-[14px] font-medium flex-1 min-w-[180px]">{type.name}</span>
      <Chip tone={type.isRequired ? 'accent' : 'muted'}>{type.isRequired ? 'Requerido' : 'Opcional'}</Chip>
      {type.hasExpiry && <Chip tone="muted">Con vencimiento</Chip>}
      {type.allowsMultiple && <Chip tone="muted">Permite varios</Chip>}
      <div className="flex items-center gap-2 ml-auto">
        <Button onClick={props.onEdit}>Editar</Button>
        <Button
          variant={type.isActive ? 'danger' : 'primary'}
          icon={type.isActive ? faBoxArchive : faRotateLeft}
          onClick={props.onToggle}
        >
          {type.isActive ? 'Archivar' : 'Reactivar'}
        </Button>
      </div>
    </div>
  )
}

function TypeFormModal(props: {
  title: string
  type?: DocumentType
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [name, setName] = useState(props.type?.name ?? '')
  const [isRequired, setIsRequired] = useState(props.type?.isRequired ?? false)
  const [hasExpiry, setHasExpiry] = useState(props.type?.hasExpiry ?? false)
  const [validityMonths, setValidityMonths] = useState(
    props.type?.validityMonths ? String(props.type.validityMonths) : ''
  )
  const [allowsMultiple, setAllowsMultiple] = useState(props.type?.allowsMultiple ?? false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(): Promise<void> {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const months = hasExpiry && validityMonths.trim() ? parseInt(validityMonths, 10) : null
      if (props.type) {
        await api.documents.updateType({
          id: props.type.id,
          patch: { name: name.trim(), isRequired, hasExpiry, validityMonths: months, allowsMultiple }
        })
      } else {
        await api.documents.createType({
          name: name.trim(),
          isRequired,
          hasExpiry,
          validityMonths: months,
          allowsMultiple
        })
      }
      props.onSaved()
    } catch {
      setError('No se pudo guardar. Verifica que el nombre no esté vacío ni repetido.')
      setBusy(false)
    }
  }

  return (
    <Modal
      title={props.title}
      onClose={props.onClose}
      footer={
        <>
          <Button onClick={props.onClose}>Cancelar</Button>
          <Button variant="primary" icon={faCheckCircle} disabled={busy || !name.trim()} onClick={() => void save()}>
            Guardar
          </Button>
        </>
      }
    >
      <Field label="Nombre">
        <TextInput value={name} onChange={setName} placeholder="Ej. Comprobante de estudios" autoFocus />
      </Field>
      <label className="flex items-center gap-2 text-[13.5px]">
        <input
          type="checkbox"
          checked={isRequired}
          onChange={(e) => setIsRequired(e.target.checked)}
          className="w-4 h-4 accent-[#163eab]"
        />
        Es requerido (cuenta en la barra de progreso del expediente)
      </label>
      <label className="flex items-center gap-2 text-[13.5px]">
        <input
          type="checkbox"
          checked={hasExpiry}
          onChange={(e) => setHasExpiry(e.target.checked)}
          className="w-4 h-4 accent-[#163eab]"
        />
        Tiene fecha de vencimiento
      </label>
      {hasExpiry && (
        <Field label="Vigencia en meses" hint="Opcional — si se captura, la fecha de vencimiento se calcula sola desde la fecha de emisión">
          <TextInput
            type="number"
            value={validityMonths}
            onChange={setValidityMonths}
            placeholder="Ej. 120 (INE), 3 (comprobante de domicilio)"
          />
        </Field>
      )}
      <label className="flex items-center gap-2 text-[13.5px]">
        <input
          type="checkbox"
          checked={allowsMultiple}
          onChange={(e) => setAllowsMultiple(e.target.checked)}
          className="w-4 h-4 accent-[#163eab]"
        />
        Permite varios documentos de este tipo (ej. certificaciones)
      </label>
      {error && <p className="text-[13px] text-bad bg-bad-bg rounded-lg px-3 py-2">{error}</p>}
    </Modal>
  )
}
