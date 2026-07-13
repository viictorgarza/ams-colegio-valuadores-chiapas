import { useEffect, useState } from 'react'
import { faFileExcel, faMagnifyingGlass, faUserPlus } from '@fortawesome/free-solid-svg-icons'
import type { MemberFilters, MemberListItem } from '@shared/contracts'
import { api } from '@renderer/api'
import { Button, Icon, Modal, Field, TextInput } from '@renderer/components/ui'
import { toTitleCase } from '@renderer/lib/textCase'
import { TitleSelect } from '@renderer/components/TitleSelect'
import { MembersTable } from './MembersTable'

type FilterKey = 'todos' | 'activos' | 'suspendidos' | 'peritos' | 'maestria' | 'doctorado'

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'todos', label: 'Todos' },
  { key: 'activos', label: 'Activos' },
  { key: 'suspendidos', label: 'Suspendidos' },
  { key: 'peritos', label: 'Peritos' },
  { key: 'maestria', label: 'Maestría' },
  { key: 'doctorado', label: 'Doctorado' }
]

function toApiFilters(search: string, filter: FilterKey): MemberFilters {
  return {
    search: search || undefined,
    statusCode: filter === 'activos' ? 'activo' : filter === 'suspendidos' ? 'suspendido' : undefined,
    isPerito: filter === 'peritos' ? true : undefined,
    hasMasters: filter === 'maestria' ? true : undefined,
    hasDoctorate: filter === 'doctorado' ? true : undefined
  }
}

export function MembersList(props: { onOpen: (id: string) => void }): React.JSX.Element {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('todos')
  const [items, setItems] = useState<MemberListItem[]>([])
  const [showNew, setShowNew] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [highlight, setHighlight] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => {
      void api.members.list(toApiFilters(search, filter)).then((r) => {
        setItems(r)
        setHighlight(0)
      })
    }, 150)
    return () => clearTimeout(t)
  }, [search, filter])

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const chosen = items[highlight]
      if (chosen) props.onOpen(chosen.id)
    }
  }

  async function exportExcel(): Promise<void> {
    const result = await api.members.exportExcel(toApiFilters(search, filter))
    setNotice(result.saved ? `Se exportaron ${result.count} miembros a ${result.path}` : null)
  }

  return (
    <div className="p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-start gap-3 mb-5">
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">Miembros</h1>
          <p className="text-[13px] text-ink3 mt-0.5">{items.length} en la vista</p>
        </div>
        <Button icon={faFileExcel} onClick={() => void exportExcel()}>
          Exportar a Excel
        </Button>
        <Button variant="primary" icon={faUserPlus} onClick={() => setShowNew(true)}>
          Nuevo miembro
        </Button>
      </div>

      <div className="relative w-full max-w-xl">
        <Icon icon={faMagnifyingGlass} className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink3" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Escribe para buscar al instante — nombre, número, CURP, teléfono, empresa… (↑ ↓ Enter)"
          className="w-full border border-line rounded-xl pl-9 pr-4 py-2 bg-surface text-[13.5px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
      </div>

      <div className="flex flex-wrap gap-2 my-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={
              f.key === filter
                ? 'px-3.5 py-1 rounded-full bg-accent text-on-accent text-[12.5px] font-semibold'
                : 'px-3.5 py-1 rounded-full border border-line text-ink2 text-[12.5px] hover:bg-inset'
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {notice && (
        <p className="text-[13px] text-good bg-good-bg rounded-lg px-3 py-2 mb-3 max-w-xl">{notice}</p>
      )}

      <MembersTable
        items={items}
        onOpen={props.onOpen}
        highlightedId={items[highlight]?.id}
        onHover={(id) => setHighlight(items.findIndex((m) => m.id === id))}
        emptyMessage={
          search || filter !== 'todos' ? (
            'Sin resultados con esta búsqueda o filtro.'
          ) : (
            <span className="inline-flex items-center gap-2">
              Aún no hay miembros.
              <Button variant="primary" icon={faUserPlus} onClick={() => setShowNew(true)}>
                Nuevo miembro
              </Button>
            </span>
          )
        }
      />

      {showNew && (
        <NewMemberModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false)
            props.onOpen(id)
          }}
        />
      )}
    </div>
  )
}

export function NewMemberModal(props: {
  onClose: () => void
  onCreated: (id: string) => void
}): React.JSX.Element {
  const [title, setTitle] = useState('')
  const [givenNames, setGivenNames] = useState('')
  const [paternal, setPaternal] = useState('')
  const [maternal, setMaternal] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(): Promise<void> {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const member = await api.members.create({
        title: title.trim() || null,
        givenNames: toTitleCase(givenNames),
        paternalSurname: paternal.trim() ? toTitleCase(paternal) : null,
        maternalSurname: maternal.trim() ? toTitleCase(maternal) : null,
        phone: phone.trim() || null
      })
      props.onCreated(member.id)
    } catch {
      setError('No se pudo crear el miembro. Revisa que el nombre no esté vacío.')
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Nuevo miembro"
      subtitle="Solo lo esencial — el expediente se completa después, con calma"
      onClose={props.onClose}
      footer={
        <>
          <Button onClick={props.onClose}>Cancelar</Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy || !givenNames.trim()}>
            Crear y abrir expediente
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[112px_1fr] gap-3">
        <Field label="Título">
          <TitleSelect value={title} onChange={setTitle} />
        </Field>
        <Field label="Nombre(s)" required>
          <TextInput value={givenNames} onChange={setGivenNames} placeholder="Juan Carlos" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Apellido paterno">
          <TextInput value={paternal} onChange={setPaternal} />
        </Field>
        <Field label="Apellido materno">
          <TextInput value={maternal} onChange={setMaternal} />
        </Field>
      </div>
      <Field label="Celular">
        <TextInput value={phone} onChange={setPhone} placeholder="9621234567" />
      </Field>
      {error && <p className="text-[13px] text-bad bg-bad-bg rounded-lg px-3 py-2">{error}</p>}
    </Modal>
  )
}
