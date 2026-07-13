import { app, BrowserWindow, dialog } from 'electron'
import Database from 'better-sqlite3'
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import archiver from 'archiver'
import { copyFileSync, createReadStream, createWriteStream, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { desc, eq, and } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { closeDb, getDb, getSqlite } from '@main/core/db'
import * as s from '@main/core/db/schema'
import { bus } from '@main/core/events/bus'
import { getSetting } from '@main/core/db/settings'
import type {
  CloudConfigStatus,
  CreateBackupResult,
  CreateCloudBackupResult,
  LastBackup,
  RestoreBackupResult,
  TestCloudConnectionResult
} from '@shared/contracts'

// Mismo patrón que members.excel.ts / documents.files.ts: el diálogo nativo
// vive junto al servicio, sin capa central. Sin cifrado (decisión de Victor,
// 2026-07-12): los respaldos son snapshots planos de ams.db.

export function dataDir(): string {
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

// ── Respaldo en la nube (Cloudflare R2, S3-compatible) ──────────────────────
// Sin cifrado, mismo criterio que el respaldo local (decisión de Victor,
// 2026-07-12). Configuración inherente del sistema (decisión de Victor,
// 2026-07-13): ya no se captura desde la UI — se lee de variables de entorno
// por instalación, para que la secretaria nunca vea ni pueda tocar las
// credenciales. Ver docs/05 o el README para la lista de variables.

interface CloudConfig {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

function readCloudConfig(): CloudConfig | null {
  const accountId = process.env['AMS_R2_ACCOUNT_ID'] ?? null
  const accessKeyId = process.env['AMS_R2_ACCESS_KEY_ID'] ?? null
  const secretAccessKey = process.env['AMS_R2_SECRET_ACCESS_KEY'] ?? null
  const bucket = process.env['AMS_R2_BUCKET'] ?? null
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null
  return { accountId, accessKeyId, secretAccessKey, bucket }
}

function buildClient(cfg: CloudConfig): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey }
  })
}

export function getCloudConfig(): CloudConfigStatus {
  const cfg = readCloudConfig()
  return {
    configured: cfg !== null,
    accountId: cfg?.accountId ?? null,
    bucket: cfg?.bucket ?? null
  }
}

export async function testCloudConnection(): Promise<TestCloudConnectionResult> {
  const cfg = readCloudConfig()
  if (!cfg) return { ok: false, message: 'Falta configurar la cuenta de Cloudflare R2.' }
  try {
    const client = buildClient(cfg)
    await client.send(new ListObjectsV2Command({ Bucket: cfg.bucket, MaxKeys: 1 }))
    return { ok: true, message: 'Conexión exitosa con el bucket.' }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'No se pudo conectar.' }
  }
}

export function getLastCloudBackup(): LastBackup | null {
  const row = getDb()
    .select({ destination: s.backupLog.destination, finishedAt: s.backupLog.finishedAt })
    .from(s.backupLog)
    .where(and(eq(s.backupLog.status, 'ok'), eq(s.backupLog.destination, 'r2')))
    .orderBy(desc(s.backupLog.finishedAt))
    .limit(1)
    .get()
  return row ?? null
}

/** Empaqueta un snapshot de la base + documents/ + recibos/ en un solo .zip temporal. */
async function buildCloudArchive(): Promise<{ path: string; cleanup: () => void }> {
  const tmpDir = mkdtempSync(join(tmpdir(), 'ams-cloud-backup-'))
  const dbSnapshot = join(tmpDir, 'ams.db')
  getSqlite().prepare('VACUUM INTO ?').run(dbSnapshot)

  const zipPath = join(tmpDir, 'ams-respaldo.zip')
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })
    output.on('close', resolve)
    archive.on('error', reject)
    archive.pipe(output)
    archive.file(dbSnapshot, { name: 'ams.db' })
    const docsDir = join(dataDir(), 'documents')
    const recibosDir = join(dataDir(), 'recibos')
    if (existsSync(docsDir)) archive.directory(docsDir, 'documents')
    if (existsSync(recibosDir)) archive.directory(recibosDir, 'recibos')
    void archive.finalize()
  })

  return { path: zipPath, cleanup: () => rmSync(tmpDir, { recursive: true, force: true }) }
}

async function uploadCloudArchive(cfg: CloudConfig, zipPath: string): Promise<number> {
  const client = buildClient(cfg)
  const size = statSync(zipPath).size
  const today = new Date().toISOString().replace(/[:.]/g, '-')
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: `respaldos/AMS_${today}.zip`,
      Body: createReadStream(zipPath),
      ContentLength: size
    })
  )
  return size
}

export async function createCloudBackup(actorId: string | null): Promise<CreateCloudBackupResult> {
  const cfg = readCloudConfig()
  if (!cfg) return { ok: false, message: 'Falta configurar la cuenta de Cloudflare R2.' }

  const startedAt = new Date().toISOString()
  let archive: { path: string; cleanup: () => void } | null = null
  try {
    archive = await buildCloudArchive()
    const sizeBytes = await uploadCloudArchive(cfg, archive.path)
    const finishedAt = new Date().toISOString()
    getDb()
      .insert(s.backupLog)
      .values({ id: uuidv7(), destination: 'r2', startedAt, finishedAt, sizeBytes, status: 'ok' })
      .run()
    bus.emit('backup.created', { actorId, path: `r2:${cfg.bucket}` })
    return { ok: true, message: 'Respaldo en la nube completado.' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido al respaldar en la nube.'
    getDb()
      .insert(s.backupLog)
      .values({ id: uuidv7(), destination: 'r2', startedAt, finishedAt: null, status: 'error', error: message })
      .run()
    return { ok: false, message }
  } finally {
    archive?.cleanup()
  }
}

/** Disparo automático y silencioso al abrir la app (docs/05 E-07): solo si hay
 * config guardada y ya pasó el intervalo mínimo desde el último respaldo r2
 * exitoso. Sin diálogos de progreso ni de error — si no hay internet (oficina
 * sin conexión) simplemente falla callado, igual que el auto-updater. */
export async function maybeRunAutoCloudBackup(): Promise<void> {
  if (!readCloudConfig()) return
  const minHours = getSetting<number>('cloud_backup_min_interval_hours', 24)
  const last = getLastCloudBackup()
  if (last?.finishedAt) {
    const hoursSince = (Date.now() - new Date(last.finishedAt).getTime()) / 3_600_000
    if (hoursSince < minHours) return
  }
  try {
    await createCloudBackup(null)
  } catch (err) {
    console.error('[respaldo-nube] falló el respaldo automático:', err instanceof Error ? err.message : err)
  }
}
