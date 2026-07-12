/**
 * Instala el binario precompilado de better-sqlite3 para la versión de Electron
 * del proyecto. Sustituye a electron-rebuild: en esta máquina las rutas contienen
 * espacios ("/Volumes/Extreme Pro 2Tb/…") y node-gyp no compila con ellas, así que
 * dependemos de los binarios publicados (existen para macOS y Windows por ABI).
 *
 * Regla derivada: solo se actualiza Electron a majors con prebuild publicado
 * de better-sqlite3 (ver README).
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const electronVersion = require('electron/package.json').version
const betterSqlite3Dir = dirname(require.resolve('better-sqlite3/package.json'))
const prebuildInstall = join(dirname(require.resolve('prebuild-install/package.json')), 'bin.js')

console.log(`better-sqlite3 → binario para Electron ${electronVersion}`)
const result = spawnSync(
  process.execPath,
  [prebuildInstall, '-r', 'electron', '-t', electronVersion],
  { cwd: betterSqlite3Dir, stdio: 'inherit' }
)

if (result.status !== 0) {
  console.error(
    `\nNo hay binario precompilado de better-sqlite3 para Electron ${electronVersion}.\n` +
      'Baja (o sube) Electron a un major con binario publicado:\n' +
      '  https://github.com/WiseLibs/better-sqlite3/releases\n'
  )
  process.exit(result.status ?? 1)
}
console.log('Binario nativo instalado correctamente.')
