import { eq } from 'drizzle-orm'
import { getDb } from './index'
import { settings } from './schema'

export function getSetting<T>(key: string, fallback: T): T {
  const row = getDb().select().from(settings).where(eq(settings.key, key)).get()
  return row ? (JSON.parse(row.value) as T) : fallback
}

export function setSetting(key: string, value: unknown): void {
  const json = JSON.stringify(value)
  getDb()
    .insert(settings)
    .values({ key, value: json })
    .onConflictDoUpdate({ target: settings.key, set: { value: json } })
    .run()
}
