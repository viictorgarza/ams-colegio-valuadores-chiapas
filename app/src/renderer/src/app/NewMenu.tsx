import { useEffect, useRef, useState } from 'react'
import {
  faCalendarPlus,
  faChevronDown,
  faClipboardCheck,
  faMoneyCheckDollar,
  faPlus,
  faUserPlus
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Icon } from '@renderer/components/ui'

export type NewMenuAction = 'miembro' | 'pago' | 'evento' | 'asamblea'

const OPTIONS: Array<{
  key: NewMenuAction
  label: string
  icon: IconDefinition
  iconBg: string
  iconColor: string
}> = [
  { key: 'miembro', label: 'Nuevo Miembro', icon: faUserPlus, iconBg: 'bg-accent-soft', iconColor: 'text-accent' },
  { key: 'pago', label: 'Nuevo Pago', icon: faMoneyCheckDollar, iconBg: 'bg-good-bg', iconColor: 'text-good' },
  { key: 'evento', label: 'Nuevo Evento', icon: faCalendarPlus, iconBg: 'bg-warn-bg', iconColor: 'text-warn' },
  {
    key: 'asamblea',
    label: 'Nueva Asamblea',
    icon: faClipboardCheck,
    iconBg: 'bg-[#efe7fb] dark:bg-[#2c2140]',
    iconColor: 'text-[#6d3fc9] dark:text-[#b79bf2]'
  }
]

function MenuItems(props: { onPick: (a: NewMenuAction) => void; highlight?: number }): React.JSX.Element {
  return (
    <>
      {OPTIONS.map((opt, i) => (
        <button
          key={opt.key}
          onClick={() => props.onPick(opt.key)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-[13.5px] font-medium rounded-lg ${
            props.highlight === i ? 'bg-inset' : 'hover:bg-inset'
          }`}
        >
          <span className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${opt.iconBg} ${opt.iconColor}`}>
            <Icon icon={opt.icon} className="w-3.5 h-3.5" />
          </span>
          {opt.label}
        </button>
      ))}
    </>
  )
}

/** Botón unificado "+ Nuevo" con dropdown visual (reemplaza los 3 botones sueltos
 * de la topbar). Mismo set de acciones que la paleta flotante de Cmd/Ctrl+N. */
export function NewMenuButton(props: { onPick: (a: NewMenuAction) => void }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-accent text-on-accent text-[13.5px] font-semibold hover:bg-accent-hover transition-colors"
      >
        <Icon icon={faPlus} className="w-3 h-3" />
        Nuevo
        <Icon icon={faChevronDown} className="w-2.5 h-2.5 opacity-70" />
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] w-56 bg-surface border border-line rounded-xl shadow-xl p-1.5 z-20">
          <MenuItems
            onPick={(a) => {
              setOpen(false)
              props.onPick(a)
            }}
          />
        </div>
      )}
    </div>
  )
}

/** Paleta flotante de Cmd/Ctrl+N: mismas 4 acciones, navegable con flechas. */
export function NewCommandPalette(props: { onClose: () => void; onPick: (a: NewMenuAction) => void }): React.JSX.Element {
  const [highlight, setHighlight] = useState(0)

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Escape') {
      props.onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, OPTIONS.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const chosen = OPTIONS[highlight]
      if (chosen) props.onPick(chosen.key)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[20vh] p-6 z-50"
      onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}
    >
      <div
        className="w-full max-w-sm bg-surface border border-line rounded-2xl shadow-2xl p-2"
        onKeyDown={onKeyDown}
        tabIndex={-1}
        ref={(el) => el?.focus()}
      >
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink3">Crear nuevo</div>
        <MenuItems highlight={highlight} onPick={props.onPick} />
      </div>
    </div>
  )
}
