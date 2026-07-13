import { app } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Config "inherente del sistema" (decisión de Victor, 2026-07-13): las
 * credenciales de R2 y la API key de OCR ya no se capturan desde la UI de la
 * app, sino desde un archivo de texto plano fuera de Program Files, que
 * Victor coloca una vez por instalación. Formato dotenv simple, sin
 * dependencia externa (KEY=VALUE, una por línea, # para comentarios).
 * No sobrescribe variables de entorno reales si ya están definidas, para no
 * romper el desarrollo local ni un despliegue que prefiera env vars del SO.
 */
export function loadLocalEnvFile(): void {
  const path = join(app.getPath('userData'), 'config.env')
  if (!existsSync(path)) return

  const text = readFileSync(path, 'utf-8')
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}
