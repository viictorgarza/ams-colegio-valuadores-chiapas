import { useEffect, useRef, useState } from 'react'
import { faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { MemberListItem } from '@shared/contracts'
import { api } from '@renderer/api'
import { Chip, Icon, statusTone } from '@renderer/components/ui'

/** Buscador persistente (docs/04 §7): mismo FTS de miembros ya construido en M1.
 * Al hacer clic se abre como paleta centrada (estilo "spotlight") con el resto
 * de la pantalla atenuado, para que la usuaria enfoque solo en buscar. */
export function GlobalSearch(props: { onOpenMember: (id: string) => void }): React.JSX.Element {
  const [open, setOpen] = useState(false)

  // Cmd+F (mac) / Ctrl+F (windows) abre el buscador desde cualquier vista.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full max-w-md flex items-center gap-2.5 border border-line rounded-xl px-4 py-2 bg-surface text-[13.5px] text-ink3 hover:border-accent transition-colors"
      >
        <Icon icon={faMagnifyingGlass} className="w-3.5 h-3.5" />
        Buscar un miembro — nombre, número, CURP, teléfono…
      </button>
      {open && (
        <SearchOverlay onClose={() => setOpen(false)} onOpenMember={(id) => { setOpen(false); props.onOpenMember(id) }} />
      )}
    </>
  )
}

function SearchOverlay(props: { onClose: () => void; onOpenMember: (id: string) => void }): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MemberListItem[]>([])
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      void api.members.list({ search: query }).then((r) => {
        setResults(r.slice(0, 10))
        setHighlight(0)
      })
    }, 150)
    return () => clearTimeout(t)
  }, [query])

  function pick(id: string): void {
    props.onOpenMember(id)
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Escape') {
      props.onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const chosen = results[highlight]
      if (chosen) pick(chosen.id)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[12vh] p-6 z-50"
      onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}
    >
      <div
        className="w-full max-w-3xl bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-line">
          <Icon icon={faMagnifyingGlass} className="w-4 h-4 text-ink3 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar un miembro — nombre, número, CURP, teléfono…"
            className="flex-1 bg-transparent outline-none text-[16px]"
          />
          <button onClick={props.onClose} className="text-ink3 hover:text-ink shrink-0" title="Cerrar (Esc)">
            <Icon icon={faXmark} className="w-4 h-4" />
          </button>
        </div>

        {results.length > 0 && (
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-line">
            {results.map((m, i) => (
              <button
                key={m.id}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(m.id)}
                className={`w-full text-left px-5 py-3.5 flex items-center gap-4 ${
                  i === highlight ? 'bg-accent-soft' : 'hover:bg-inset'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-semibold">{m.fullName}</div>
                  <div className="text-[13px] text-ink3 mt-0.5">
                    {[m.memberNumber, m.phone, m.email].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <Chip tone={statusTone(m.statusCode)} dot>
                  {m.statusName}
                </Chip>
              </button>
            ))}
          </div>
        )}

        {query.trim() && results.length === 0 && (
          <div className="px-5 py-8 text-center text-[13.5px] text-ink3">Sin resultados para “{query}”.</div>
        )}

        {!query.trim() && (
          <div className="px-5 py-8 text-center text-[13px] text-ink3">
            Escribe para buscar. Usa ↑ ↓ para navegar y Enter para abrir.
          </div>
        )}
      </div>
    </div>
  )
}
