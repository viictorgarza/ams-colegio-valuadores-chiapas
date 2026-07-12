import { app, BrowserWindow, dialog, shell } from 'electron'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

// Mismo patrón que payments/receipt.ts y members/members.excel.ts: el manejo de
// archivos vive junto a su módulo, no en una capa central (docs/02 §5 lo prevé
// como core/files más adelante; hoy se replica el patrón ya validado).

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.heic': 'image/heic',
  '.pdf': 'application/pdf'
}

const ALLOWED_EXTENSIONS = Object.keys(MIME_BY_EXT)

export class FileTypeError extends Error {}

function assertAllowedExtension(originalName: string): void {
  if (!ALLOWED_EXTENSIONS.includes(extname(originalName).toLowerCase())) {
    throw new FileTypeError('Solo se aceptan JPG, PNG, HEIC o PDF.')
  }
}

function documentsDir(): string {
  const dataDir = process.env['AMS_DATA_DIR'] ?? join(app.getPath('userData'), 'data')
  const dir = join(dataDir, 'documents')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function mimeTypeFor(originalName: string): string {
  return MIME_BY_EXT[extname(originalName).toLowerCase()] ?? 'application/octet-stream'
}

export function storedFilePath(sha256: string, originalName: string): string {
  return join(documentsDir(), `${sha256}${extname(originalName).toLowerCase()}`)
}

function storeBuffer(buffer: Buffer, originalName: string): { sha256: string; sizeBytes: number; originalName: string } {
  assertAllowedExtension(originalName)
  const sha256 = createHash('sha256').update(buffer).digest('hex')
  const storedPath = storedFilePath(sha256, originalName)
  if (!existsSync(storedPath)) writeFileSync(storedPath, buffer)
  return { sha256, sizeBytes: buffer.length, originalName }
}

/** Diálogo nativo de selección + guardado por hash (deduplicado). null si se canceló. */
export async function pickAndStoreFile(): Promise<{
  sha256: string
  sizeBytes: number
  originalName: string
} | null> {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const pick = await dialog.showOpenDialog(win!, {
    title: 'Seleccionar archivo',
    properties: ['openFile'],
    filters: [{ name: 'Documentos', extensions: ['jpg', 'jpeg', 'png', 'heic', 'pdf'] }]
  })
  if (pick.canceled || pick.filePaths.length === 0) return null

  const sourcePath = pick.filePaths[0]!
  const buffer = readFileSync(sourcePath)
  return storeBuffer(buffer, basename(sourcePath))
}

/** Arrastrar y soltar (docs/04 §3): la ruta ya viene del sistema de archivos vía
 * webUtils.getPathForFile en el renderer — aquí solo se lee, valida y guarda. */
export function storeFileFromPath(sourcePath: string): {
  sha256: string
  sizeBytes: number
  originalName: string
} {
  const buffer = readFileSync(sourcePath)
  return storeBuffer(buffer, basename(sourcePath))
}

/** Abre el archivo con la aplicación predeterminada del sistema (foto/PDF ya conocidos por la usuaria). */
export async function openStoredFile(path: string): Promise<void> {
  const err = await shell.openPath(path)
  if (err) throw new Error(err)
}

/** Diálogo nativo de guardado; copia el archivo administrado a donde elija la usuaria. */
export async function saveStoredFileAs(path: string, suggestedName: string): Promise<string | null> {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const pick = await dialog.showSaveDialog(win!, {
    title: 'Guardar documento',
    defaultPath: join(app.getPath('documents'), suggestedName)
  })
  if (pick.canceled || !pick.filePath) return null
  copyFileSync(path, pick.filePath)
  return pick.filePath
}

export function readStoredFileBase64(path: string): string {
  return readFileSync(path).toString('base64')
}
