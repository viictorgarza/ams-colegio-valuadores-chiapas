/**
 * Instala el binario precompilado de better-sqlite3 para la versión de Electron
 * del proyecto. Sustituye a electron-rebuild: en esta máquina las rutas contienen
 * espacios ("/Volumes/Extreme Pro 2Tb/…") y node-gyp no compila con ellas, así que
 * dependemos de los binarios publicados (existen para macOS y Windows por ABI).
 *
 * Sin --platform/--arch, descarga el binario para el host actual (uso normal en
 * postinstall). Con --platform=win32 --arch=x64 descarga el binario de Windows aunque
 * se ejecute en Mac — así el empaquetado cruzado (package:win) no cuela por error el
 * binario de macOS dentro del instalador de Windows, que era el bug real detrás de
 * "el instalador no hace nada": la app arrancaba con un .node de la plataforma equivocada.
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

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
const platform = arg('platform') ?? process.platform
const arch = arg('arch') ?? process.arch

console.log(`better-sqlite3 → binario para Electron ${electronVersion} (${platform}/${arch})`)
const result = spawnSync(
  process.execPath,
  [prebuildInstall, '-r', 'electron', '-t', electronVersion],
  {
    cwd: betterSqlite3Dir,
    stdio: 'inherit',
    env: { ...process.env, npm_config_platform: platform, npm_config_arch: arch },
  }
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
