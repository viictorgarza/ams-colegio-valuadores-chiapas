import type { ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faSort, faSortDown, faSortUp } from '@fortawesome/free-solid-svg-icons'
import type { SortDir } from './useSort'

// Componentes base mínimos siguiendo los tokens de docs/04 §7.
// Cuando entre shadcn/ui (hitos posteriores) estos se sustituyen pieza por pieza.

/** Envoltorio delgado sobre FontAwesome (2026-07-12): set de íconos único en toda la app. */
export function Icon(props: { icon: IconDefinition; className?: string }): React.JSX.Element {
  return <FontAwesomeIcon icon={props.icon} className={props.className ?? 'w-3.5 h-3.5'} />
}

/** Encabezado de columna ordenable (clic = asc/desc) y arrastrable para
 * reordenar columnas (arrastrar el encabezado sobre otro los intercambia). */
export function SortableTh(props: {
  label: string
  sortKey: string
  activeKey: string
  dir: SortDir
  onClick: (key: string) => void
  className?: string
  onReorder?: (fromKey: string, toKey: string) => void
}): React.JSX.Element {
  const active = props.sortKey === props.activeKey
  const draggable = !!props.onReorder
  return (
    <th
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return
        e.dataTransfer.setData('text/plain', props.sortKey)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => draggable && e.preventDefault()}
      onDrop={(e) => {
        if (!draggable) return
        e.preventDefault()
        const fromKey = e.dataTransfer.getData('text/plain')
        if (fromKey) props.onReorder?.(fromKey, props.sortKey)
      }}
      title={draggable ? 'Arrastra para reordenar columnas' : undefined}
      className={`px-4 py-2.5 border-b border-line font-semibold ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${props.className ?? ''}`}
    >
      <button
        onClick={() => props.onClick(props.sortKey)}
        className="flex items-center gap-1.5 hover:text-ink"
      >
        {props.label}
        <Icon
          icon={active ? (props.dir === 'asc' ? faSortUp : faSortDown) : faSort}
          className={`w-3 h-3 ${active ? 'text-accent' : 'text-ink3/60'}`}
        />
      </button>
    </th>
  )
}

export function Button(props: {
  children: ReactNode
  icon?: IconDefinition
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'ghost' | 'danger'
  disabled?: boolean
  title?: string
}): React.JSX.Element {
  const variant = props.variant ?? 'ghost'
  const styles = {
    primary: 'bg-accent hover:bg-accent-hover text-on-accent font-semibold border-transparent',
    ghost: 'bg-surface hover:bg-inset text-ink2 hover:text-ink border-line',
    danger: 'bg-surface hover:bg-bad-bg text-bad border-line'
  }[variant]
  return (
    <button
      type={props.type ?? 'button'}
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-[13px] whitespace-nowrap shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles}`}
    >
      {props.icon && <Icon icon={props.icon} className="w-3.5 h-3.5" />}
      {props.children}
    </button>
  )
}

const CHIP_STYLES = {
  good: 'text-good bg-good-bg',
  warn: 'text-warn bg-warn-bg',
  bad: 'text-bad bg-bad-bg',
  muted: 'text-ink2 bg-inset border border-line',
  accent: 'text-accent bg-accent-soft'
} as const

export function Chip(props: {
  children: ReactNode
  tone?: keyof typeof CHIP_STYLES
  dot?: boolean
  icon?: IconDefinition
}): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${CHIP_STYLES[props.tone ?? 'muted']}`}
    >
      {props.dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {props.icon && <Icon icon={props.icon} className="w-3 h-3" />}
      {props.children}
    </span>
  )
}

export function statusTone(code: string): keyof typeof CHIP_STYLES {
  if (code === 'activo') return 'good'
  if (code === 'suspendido') return 'warn'
  if (code === 'fallecido') return 'bad'
  return 'muted'
}

export function Field(props: {
  label: string
  children: ReactNode
  hint?: string
  error?: string
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-xs font-semibold text-ink2">{props.label}</span>
      {props.children}
      {props.error ? (
        <span className="text-xs text-bad">{props.error}</span>
      ) : (
        props.hint && <span className="text-xs text-ink3">{props.hint}</span>
      )}
    </label>
  )
}

export function TextInput(props: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
  type?: string
  className?: string
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onBlur?: () => void
}): React.JSX.Element {
  return (
    <input
      type={props.type ?? 'text'}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      onKeyDown={props.onKeyDown}
      onBlur={props.onBlur}
      placeholder={props.placeholder}
      autoFocus={props.autoFocus}
      className={`border border-line rounded-lg px-3 py-1.5 bg-surface text-[13.5px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft w-full ${props.className ?? ''}`}
    />
  )
}

export function Modal(props: {
  title: string
  subtitle?: string
  children: ReactNode
  footer: ReactNode
  onClose: () => void
}): React.JSX.Element {
  return (
    <div
      className="fixed inset-0 bg-black/40 grid place-items-center p-6 z-50"
      onKeyDown={(e) => e.key === 'Escape' && props.onClose()}
      onClick={(e) => e.target === e.currentTarget && props.onClose()}
    >
      <div className="w-full max-w-md bg-surface border border-line rounded-2xl shadow-xl p-6">
        <h2 className="text-base font-semibold">{props.title}</h2>
        {props.subtitle && <p className="text-xs text-ink3 mt-0.5">{props.subtitle}</p>}
        <div className="mt-4 flex flex-col gap-3">{props.children}</div>
        <div className="mt-5 flex justify-end gap-2">{props.footer}</div>
      </div>
    </div>
  )
}
