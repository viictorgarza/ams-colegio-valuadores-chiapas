import { useMemo, useState } from 'react'

const COMMON_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com',
  'icloud.com',
  'live.com',
  'prodigy.net.mx'
]

/** Campo de correo con autocompletado de dominios comunes al escribir "@". */
export function EmailInput(props: {
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
}): React.JSX.Element {
  const [highlight, setHighlight] = useState(0)
  const [open, setOpen] = useState(false)

  const atIndex = props.value.indexOf('@')
  const localPart = atIndex >= 0 ? props.value.slice(0, atIndex) : props.value
  const typedDomain = atIndex >= 0 ? props.value.slice(atIndex + 1) : ''

  const suggestions = useMemo(() => {
    if (atIndex < 0 || !localPart) return []
    return COMMON_DOMAINS.filter((d) => d.startsWith(typedDomain))
  }, [atIndex, localPart, typedDomain])

  const showList = open && suggestions.length > 0 && !COMMON_DOMAINS.includes(typedDomain)

  function applySuggestion(domain: string): void {
    props.onChange(`${localPart}@${domain}`)
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        type="email"
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
        placeholder="correo@dominio.com"
        className="border border-line rounded-lg px-3 py-1.5 bg-surface text-[13.5px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft w-full"
      />
      {showList && (
        <div className="absolute z-20 mt-1 w-full bg-surface border border-line rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((d, i) => (
            <button
              key={d}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applySuggestion(d)}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full text-left px-3 py-1.5 text-[13px] ${
                i === highlight ? 'bg-accent-soft text-accent' : 'hover:bg-inset'
              }`}
            >
              {localPart}@{d}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
