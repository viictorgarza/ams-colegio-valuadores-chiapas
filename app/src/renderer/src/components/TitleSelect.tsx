import { useState } from 'react'
import { COMMON_TITLES } from '@renderer/data/titles'
import { TextInput } from '@renderer/components/ui'

const OTHER = '__otro__'

/** Dropdown de título con las opciones más comunes (Ing./Arq./Mtro./Dr.) y
 * "Otro" para no perder flexibilidad ante un título fuera de la lista. */
export function TitleSelect(props: { value: string; onChange: (v: string) => void }): React.JSX.Element {
  const knownValue = COMMON_TITLES.includes(props.value)
  const [customMode, setCustomMode] = useState(!knownValue && props.value.trim() !== '')

  if (customMode) {
    return (
      <div className="flex gap-1.5">
        <TextInput value={props.value} onChange={props.onChange} placeholder="Ing., Arq., Lic." autoFocus />
        <button
          type="button"
          onClick={() => {
            setCustomMode(false)
            props.onChange('')
          }}
          className="px-2.5 rounded-lg border border-line text-ink3 text-[12.5px] hover:bg-inset shrink-0"
        >
          Lista
        </button>
      </div>
    )
  }

  return (
    <select
      value={knownValue ? props.value : ''}
      onChange={(e) => {
        if (e.target.value === OTHER) {
          setCustomMode(true)
          props.onChange('')
        } else {
          props.onChange(e.target.value)
        }
      }}
      className="border border-line rounded-lg px-3 py-1.5 bg-surface text-[13.5px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft w-full"
    >
      <option value="">— Selecciona —</option>
      {COMMON_TITLES.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
      <option value={OTHER}>Otro…</option>
    </select>
  )
}
