import type { ReactNode } from 'react'
import { useEffect } from 'react'

// Componentes base, versión táctil de components/ui.tsx del escritorio:
// mismos tokens, targets de toque ≥44px (guía de Apple para iPad).

export function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled,
  full
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  type?: 'button' | 'submit'
  disabled?: boolean
  full?: boolean
}) {
  const styles = {
    primary: 'bg-accent text-on-accent hover:bg-accent-hover',
    secondary: 'bg-inset text-ink border border-line hover:bg-line/60',
    ghost: 'text-accent hover:bg-accent-soft',
    danger: 'bg-bad-bg text-bad hover:opacity-80'
  }[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-11 rounded-xl px-4 font-medium transition-colors disabled:opacity-50 ${styles} ${full ? 'w-full' : ''}`}
    >
      {children}
    </button>
  )
}

export function Chip({ tone, children }: { tone: 'good' | 'warn' | 'bad' | 'neutral' | 'accent'; children: ReactNode }) {
  const styles = {
    good: 'bg-good-bg text-good',
    warn: 'bg-warn-bg text-warn',
    bad: 'bg-bad-bg text-bad',
    neutral: 'bg-inset text-ink2',
    accent: 'bg-accent-soft text-accent'
  }[tone]
  return <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${styles}`}>{children}</span>
}

export function Field({
  label,
  children
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink2">{label}</span>
      {children}
    </label>
  )
}

export function TextInput({
  value,
  onChange,
  type = 'text',
  placeholder,
  autoFocus,
  onBlur
}: {
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  autoFocus?: boolean
  onBlur?: () => void
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onBlur={onBlur}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-ink outline-none focus:border-accent"
    />
  )
}

export function Select({
  value,
  onChange,
  options
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-h-11 w-full appearance-none rounded-xl border border-line bg-surface px-3 text-ink outline-none focus:border-accent"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function TextArea({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-line bg-surface p-3 text-ink outline-none focus:border-accent"
    />
  )
}

export function Modal({
  title,
  onClose,
  children
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full text-ink3 hover:bg-inset" aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Card({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-line bg-surface p-4 ${onClick ? 'cursor-pointer active:bg-inset' : ''}`}
    >
      {children}
    </div>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-ink3">{children}</p>
}

export function Spinner() {
  return (
    <div className="flex justify-center py-10">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
    </div>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="mb-4 rounded-xl bg-bad-bg px-4 py-3 text-bad">{message}</div>
}
