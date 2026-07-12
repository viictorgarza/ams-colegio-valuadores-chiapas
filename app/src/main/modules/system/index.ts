import { app } from 'electron'
import { and, asc, count, eq, isNull } from 'drizzle-orm'
import { handle } from '@main/core/ipc/registry'
import { contracts } from '@shared/contracts'
import { getDb, getSqlite } from '@main/core/db'
import * as s from '@main/core/db/schema'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'

export function register(): void {
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
