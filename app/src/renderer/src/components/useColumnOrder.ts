import { useState } from 'react'

/** Orden de columnas de una tabla, arrastrable, persistido en localStorage por tabla. */
export function useColumnOrder(storageKey: string, defaultOrder: string[]) {
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const saved = JSON.parse(raw) as string[]
        if (saved.length === defaultOrder.length && defaultOrder.every((k) => saved.includes(k))) {
          return saved
        }
      }
    } catch {
      // localStorage corrupto o inaccesible: se ignora, se usa el orden por defecto
    }
    return defaultOrder
  })

  function moveColumn(from: string, to: string): void {
    if (from === to) return
    setOrder((prev) => {
      const next = [...prev]
      const fromIdx = next.indexOf(from)
      const toIdx = next.indexOf(to)
      if (fromIdx === -1 || toIdx === -1) return prev
      next.splice(fromIdx, 1)
      next.splice(toIdx, 0, from)
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // no-op si no hay storage disponible
      }
      return next
    })
  }

  return { order, moveColumn }
}
