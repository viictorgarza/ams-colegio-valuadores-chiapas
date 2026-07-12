import { useMemo, useState } from 'react'

function normalize(v: string): string {
  return v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Campo de texto con autocompletado sobre un catálogo offline fijo (sin
 * internet en la oficina). Si la opción no está en la lista, se sigue
 * pudiendo capturar libremente. */
export function CatalogAutocomplete(props: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  autoFocus?: boolean
}): React.JSX.Element {
  const [highlight, setHighlight] = useState(0)
  const [open, setOpen] = useState(false)

  const suggestions = useMemo(() => {
    const q = normalize(props.value.trim())
    if (!q) return []
    return props.options.filter((u) => normalize(u).includes(q)).slice(0, 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value, props.options])

  const showList = open && suggestions.length > 0 && !props.options.includes(props.value.trim())

  function applySuggestion(name: string): void {
    props.onChange(name)
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={props.value}
        autoFocus={props.autoFocus}
        onChange={(e) => {
          props.onChange(e.target.value)
          setOpen(true)
          setHighlight(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!showList) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlight((h) => Math.min(h + 1, suggestions.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlight((h) => Math.max(h - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            applySuggestion(suggestions[highlight]!)
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        placeholder={props.placeholder}
        className="border border-line rounded-lg px-3 py-1.5 bg-surface text-[13.5px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft w-full"
      />
      {showList && (
        <div className="absolute z-20 mt-1 w-full bg-surface border border-line rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((u, i) => (
            <button
              key={u}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applySuggestion(u)}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full text-left px-3 py-1.5 text-[13px] ${
                i === highlight ? 'bg-accent-soft text-accent' : 'hover:bg-inset'
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
