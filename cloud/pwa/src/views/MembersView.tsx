import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { MemberListItem } from '../types'
import { useToast } from '../toast'
import { Button, Card, Chip, EmptyState, Field, Modal, Spinner, TextInput } from '../ui'

function statusTone(code: string): 'good' | 'warn' | 'bad' | 'neutral' {
  if (code === 'activo') return 'good'
  if (code === 'suspendido') return 'warn'
  if (code === 'fallecido') return 'bad'
  return 'neutral'
}

export function MembersView({ onOpen }: { onOpen: (id: string) => void }) {
  const [members, setMembers] = useState<MemberListItem[] | null>(null)
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined)
  const toast = useToast()

  const load = (q: string): void => {
    api.members
      .list(q || undefined)
      .then(setMembers)
      .catch((e: Error) => toast(e.message, 'bad'))
  }

  useEffect(() => {
    load('')
  }, [])

  const onSearch = (value: string): void => {
    setSearch(value)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => load(value), 250)
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Miembros</h1>
        <Button onClick={() => setShowNew(true)}>+ Nuevo</Button>
      </div>
      <div className="mb-4">
        <TextInput value={search} onChange={onSearch} placeholder="Buscar por nombre, número, teléfono…" />
      </div>

      {!members ? (
        <Spinner />
      ) : members.length === 0 ? (
        <EmptyState>{search ? 'Sin resultados para esa búsqueda.' : 'Aún no hay miembros registrados.'}</EmptyState>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <Card key={m.id} onClick={() => onOpen(m.id)}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.fullName}</p>
                  <p className="text-sm text-ink3">
                    {m.memberNumber}
                    {m.phone && ` · ${m.phone}`}
                  </p>
                </div>
                <Chip tone={statusTone(m.statusCode)}>{m.statusName}</Chip>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showNew && (
        <NewMemberModal
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false)
            toast('Miembro registrado')
            onOpen(id)
          }}
        />
      )}
    </div>
  )
}

function NewMemberModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState('')
  const [givenNames, setGivenNames] = useState('')
  const [paternal, setPaternal] = useState('')
  const [maternal, setMaternal] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  const submit = async (): Promise<void> => {
    setBusy(true)
    try {
      const m = await api.members.create({
        title: title.trim() || null,
        givenNames: givenNames.trim(),
        paternalSurname: paternal.trim() || null,
        maternalSurname: maternal.trim() || null,
        phone: phone.trim() || null
      })
      onCreated(m.id)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo registrar', 'bad')
      setBusy(false)
    }
  }

  return (
    <Modal title="Nuevo miembro" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Título (Ing., Arq., …)">
          <TextInput value={title} onChange={setTitle} placeholder="Opcional" />
        </Field>
        <Field label="Nombre(s)">
          <TextInput value={givenNames} onChange={setGivenNames} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Apellido paterno">
            <TextInput value={paternal} onChange={setPaternal} />
          </Field>
          <Field label="Apellido materno">
            <TextInput value={maternal} onChange={setMaternal} />
          </Field>
        </div>
        <Field label="Celular">
          <TextInput value={phone} onChange={setPhone} type="tel" placeholder="Opcional" />
        </Field>
        <Button onClick={() => void submit()} disabled={busy || !givenNames.trim()} full>
          {busy ? 'Guardando…' : 'Registrar'}
        </Button>
      </div>
    </Modal>
  )
}
