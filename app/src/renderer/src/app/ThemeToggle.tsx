import { useEffect, useState } from 'react'
import { faSun, faMoon } from '@fortawesome/free-solid-svg-icons'
import { Icon } from '@renderer/components/ui'

type Theme = 'light' | 'dark'
const STORAGE_KEY = 'ams-theme'

function initialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Botón de modo oscuro (Victor, 2026-07-12): circular, esquina inferior izquierda,
 * persistente en todas las vistas — vive en el pie del sidebar, que nunca se desmonta. */
export function ThemeToggle(): React.JSX.Element {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.dataset['theme'] = theme
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  return (
    <button
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label="Cambiar apariencia"
      className="w-9 h-9 shrink-0 rounded-full border border-line bg-surface text-ink2 grid place-items-center shadow-sm hover:text-accent hover:border-accent transition-colors"
    >
      <Icon icon={theme === 'dark' ? faSun : faMoon} className="w-4 h-4" />
    </button>
  )
}
