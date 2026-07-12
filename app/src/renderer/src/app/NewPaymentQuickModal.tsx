import { useEffect, useState } from 'react'
import type { MemberListItem } from '@shared/contracts'
import { api } from '@renderer/api'
import { Button, Modal, TextInput } from '@renderer/components/ui'
import { NewPaymentModal, type PaymentMemberRef } from '@renderer/features/members/PaymentsTab'

/** "+ Nuevo Pago" desde el dashboard: primero se busca al miembro, luego se
 * reusa el mismo formulario de pago que ya existe dentro de la ficha. */
export function NewPaymentQuickModal(props: {
  onClose: () => void
  onCreated: (memberId: string) => void
}): React.JSX.Element {
  const [member, setMember] = useState<PaymentMemberRef | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MemberListItem[]>([])
  const [highlight, setHighlight] = useState(0)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      void api.members.list({ search: query }).then((r) => {
        setResults(r.slice(0, 8))
        setHighlight(0)
      })
    }, 150)
    return () => clearTimeout(t)
  }, [query])

  if (member) {
    return (
      <NewPaymentModal
        member={member}
        onClose={props.onClose}
        onCreated={() => props.onCreated(member.id)}
      />
    )
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const chosen = results[highlight]
      if (chosen) setMember(chosen)
    }
  }

  return (
    <Modal
      title="Nuevo pago"
      subtitle="Primero busca al miembro"
      onClose={props.onClose}
      footer={<Button onClick={props.onClose}>Cancelar</Button>}
    >
      <TextInput
        value={query}
        onChange={setQuery}
        onKeyDown={onKeyDown}
        placeholder="Nombre, número, CURP, teléfono…"
        autoFocus
      />
      {results.length > 0 && (
        <div className="border border-line rounded-xl divide-y divide-line max-h-64 overflow-y-auto">
          {results.map((m, i) => (
            <button
              key={m.id}
              onMouseEnter={() => setHighlight(i)}
              onClick={() => setMember(m)}
              className={`w-full text-left px-3.5 py-2.5 flex items-center gap-2.5 ${
                i === highlight ? 'bg-accent-soft' : 'hover:bg-inset'
              }`}
            >
              <span className="text-[13.5px] flex-1 truncate">{m.fullName}</span>
              <span className="text-xs text-ink3 tabular-nums">{m.memberNumber}</span>
            </button>
          ))}
        </div>
      )}
      {query.trim() && results.length === 0 && (
        <p className="text-[13px] text-ink3">Sin resultados para “{query}”.</p>
      )}
    </Modal>
  )
}
