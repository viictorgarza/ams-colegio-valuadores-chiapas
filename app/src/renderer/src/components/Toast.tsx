import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { faCheckCircle, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { Icon } from './ui'

type ToastTone = 'good' | 'bad'
interface ToastItem {
  id: number
  tone: ToastTone
  text: string
}

type Notify = (text: string, tone?: ToastTone) => void

const ToastContext = createContext<Notify | null>(null)

/** Confirmación visual global de "guardado" (pedido de Victor, 2026-07-13):
 * los formularios de la app guardan al vuelo sin recargar, lo que puede
 * generar duda de si el cambio se aplicó. Este toast se autodesaparece, a
 * diferencia de los mensajes inline persistentes que ya usan algunas vistas
 * para errores (esos se quedan visibles porque requieren acción). */
export function ToastProvider(props: { children: ReactNode }): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const notify = useCallback<Notify>((text, tone = 'good') => {
    const id = nextId.current++
    setToasts((t) => [...t, { id, tone, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800)
  }, [])

  return (
    <ToastContext.Provider value={notify}>
      {props.children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg shadow-lg border text-[13px] font-medium ${
              t.tone === 'good' ? 'bg-good-bg text-good border-good/20' : 'bg-bad-bg text-bad border-bad/20'
            }`}
          >
            <Icon icon={t.tone === 'good' ? faCheckCircle : faTriangleExclamation} className="w-3.5 h-3.5" />
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/** Hook de conveniencia: `notify('Guardado.')` o `notify('Error al guardar', 'bad')`. */
export function useToast(): Notify {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}
