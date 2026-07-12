import { useState } from 'react'

export type SortDir = 'asc' | 'desc'

/** Ordenamiento local de tablas (clic en encabezado = asc/desc). Listas pequeñas
 * (decenas de filas) — se reordena en cada render, sin memoización. */
export function useSort<K extends string>(defaultKey: K, defaultDir: SortDir = 'asc') {
  const [key, setKey] = useState<K>(defaultKey)
  const [dir, setDir] = useState<SortDir>(defaultDir)

  function toggle(k: K): void {
    if (k === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setKey(k)
      setDir('asc')
    }
  }

  function sorted<T>(rows: T[], accessors: Record<K, (row: T) => string | number | null>): T[] {
    const get = accessors[key]
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = get(a)
      const bv = get(b)
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'es')
      return dir === 'asc' ? cmp : -cmp
    })
    return copy
  }

  return { key, dir, toggle, sorted }
}
