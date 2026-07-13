import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

// Mismo patrón que components/Toast.tsx del escritorio: confirmación breve
// que desaparece sola, para reducir la ansiedad del "¿sí se guardó?".

type Toast = { id: number; message: string; tone: 'good' | 'bad' }
const ToastContext = createContext<(message: string, tone?: 'good' | 'bad') => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const show = useCallback((message: string, tone: 'good' | 'bad' = 'good') => {
    const id = nextId.current++
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-xl px-4 py-3 font-medium shadow-lg ${
              t.tone === 'good' ? 'bg-good-bg text-good' : 'bg-bad-bg text-bad'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
