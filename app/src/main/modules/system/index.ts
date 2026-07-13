import { app } from 'electron'
import { and, asc, count, eq, isNull } from 'drizzle-orm'
import { handle } from '@main/core/ipc/registry'
import { contracts } from '@shared/contracts'
import { getDb, getSqlite } from '@main/core/db'
import * as s from '@main/core/db/schema'
import { getSetting, setSetting } from '@main/core/db/settings'
import { bus } from '@main/core/events/bus'
import { me } from '../users/users.service'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'

const actor = (): string | null => me()?.id ?? null

export function register(): void {
  handle(contracts.system.firstRunPending, () => !getSetting<boolean>('first_run_completed', false))
  handle(contracts.system.completeFirstRun, () => {
    setSetting('first_run_completed', true)
    bus.emit('first_run.completed', { actorId: actor() })
    return { ok: true as const }
  })

  handle(contracts.system.getAutoLockMinutes, () => getSetting<number>('auto_lock_minutes', 10))
  handle(contracts.system.setAutoLockMinutes, ({ minutes }) => {
    setSetting('auto_lock_minutes', minutes)
    return { ok: true as const }
  })

  handle(contracts.system.info, () => {
    const db = getDb()
    const rows = (table: SQLiteTable): number =>
      db.select({ n: count() }).from(table).get()?.n ?? 0
    const tableCount = getSqlite()
      .prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .get() as { n: number }
    const requiredTypes = db
      .select({ name: s.documentTypes.name })
      .from(s.documentTypes)
      .where(and(eq(s.documentTypes.isRequired, true), eq(s.documentTypes.isActive, true)))
      .orderBy(asc(s.documentTypes.sortOrder))
      .all()
    return {
      appVersion: app.getVersion(),
      tableCount: tableCount.n,
      memberCount: db.select({ n: count() }).from(s.members).where(isNull(s.members.deletedAt)).get()?.n ?? 0,
      userCount: rows(s.users),
      documentTypeCount: rows(s.documentTypes),
      requiredDocumentTypes: requiredTypes.map((t) => t.name)
    }
  })
}
