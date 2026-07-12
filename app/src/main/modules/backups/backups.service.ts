import { app, BrowserWindow, dialog } from 'electron'
import Database from 'better-sqlite3'
import { copyFileSync, existsSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { desc, eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { closeDb, getDb, getSqlite } from '@main/core/db'
import * as s from '@main/core/db/schema'
import { bus } from '@main/core/events/bus'
import type { CreateBackupResult, LastBackup, RestoreBackupResult } from '@shared/contracts'

// Mismo patrón que members.excel.ts / documents.files.ts: el diálogo nativo
// vive junto al servicio, sin capa central. Sin cifrado (decisión de Victor,
// 2026-07-12): los respaldos son snapshots planos de ams.db.

function dataDir(): string {
  return process.env['AMS_DATA_DIR'] ?? join(app.getPath('userData'), 'data')
}

function focusedWindow(): BrowserWindow {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]!
}

/** Snapshot consistente vía VACUUM INTO (docs/05 E-07) a un archivo elegido por la usuaria. */
export async function createLocalBackup(actorId: string | null): Promise<CreateBackupResult> {
  const today = new Date().toISOString().slice(0, 10)
  const pick = await dialog.showSaveDialog(focusedWindow(), {
    title: 'Crear respaldo local',
    defaultPath: join(app.getPath('documents'), `AMS_Respaldo_${today}.db`),
    filters: [{ name: 'Base de datos AMS', extensions: ['db'] }]
  })
  if (pick.canceled || !pick.filePath) return { saved: false, path: null }

  // VACUUM INTO falla si el archivo destino ya existe.
  if (existsSync(pick.filePath)) rmSync(pick.filePath)
  const startedAt = new Date().toISOString()
  getSqlite().prepare('VACUUM INTO ?').run(pick.filePath)
  const finishedAt = new Date().toISOString()

  getDb()
    .insert(s.backupLog)
    .values({
      id: uuidv7(),
      destination: 'local',
      startedAt,
      finishedAt,
      sizeBytes: statSync(pick.filePath).size,
      status: 'ok'
    })
    .run()

  bus.emit('backup.created', { actorId, path: pick.filePath })
  return { saved: true, path: pick.filePath }
}

/** Último respaldo registrado (cualquier destino) — para el indicador del sidebar. */
export function getLastBackup(): LastBackup | null {
  const row = getDb()
    .select({ destination: s.backupLog.destination, finishedAt: s.backupLog.finishedAt })
    .from(s.backupLog)
    .where(eq(s.backupLog.status, 'ok'))
    .orderBy(desc(s.backupLog.finishedAt))
    .limit(1)
    .get()
  return row ?? null
}

/** Valida que un archivo sea una base de AMS reconocible antes de restaurar. */
function isValidBackup(path: string): boolean {
  try {
    const check = new Database(path, { readonly: true, fileMustExist: true })
    try {
      const row = check
        .prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('members', 'organization', 'payments')")
        .get() as { n: number }
      return row.n === 3
    } finally {
      check.close()
    }
  } catch {
    return false
  }
}

/**
 * Restaura reemplazando ams.db por el archivo elegido y reinicia la app
 * (docs/05 E-07 "restauración guiada"). Requiere que la usuaria ya haya
 * confirmado la advertencia destructiva en el renderer.
 */
export async function restoreFromLocalBackup(): Promise<RestoreBackupResult> {
  const pick = await dialog.showOpenDialog(focusedWindow(), {
    title: 'Restaurar desde respaldo local',
    filters: [{ name: 'Base de datos AMS', extensions: ['db'] }],
    properties: ['openFile']
  })
  if (pick.canceled || pick.filePaths.length === 0) return { status: 'canceled', message: null }

  const source = pick.filePaths[0]!
  if (!isValidBackup(source)) {
    return { status: 'invalid', message: 'El archivo elegido no es un respaldo de AMS reconocible.' }
  }

  try {
    const dest = join(dataDir(), 'ams.db')
    closeDb()
    copyFileSync(source, dest)
    for (const suffix of ['-wal', '-shm']) {
      if (existsSync(dest + suffix)) rmSync(dest + suffix)
    }
    app.relaunch()
    app.exit(0)
    return { status: 'restored', message: null }
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Error desconocido al restaurar.' }
  }
}
