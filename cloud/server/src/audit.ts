import { nowIso, uuidv7 } from './util'

/** Auditoría con los mismos nombres de acción que el escritorio; device='pwa'
 * distingue lo capturado desde el iPad de lo capturado en la laptop. */
export async function audit(
  db: D1Database,
  entry: {
    userId: string | null
    action: string
    entityType?: string
    entityId?: string
    before?: unknown
    after?: unknown
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, before_json, after_json, device, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pwa', ?)`
    )
    .bind(
      uuidv7(),
      entry.userId,
      entry.action,
      entry.entityType ?? null,
      entry.entityId ?? null,
      entry.before === undefined ? null : JSON.stringify(entry.before),
      entry.after === undefined ? null : JSON.stringify(entry.after),
      nowIso()
    )
    .run()
}
