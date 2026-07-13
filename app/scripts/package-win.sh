#!/usr/bin/env bash
# Empaqueta el instalador de Windows asegurando que better-sqlite3 se empaquete
# con el binario nativo de win32/x64, sin importar en qué SO se ejecute este
# script. Al terminar (incluso si falla), restaura el binario del host actual
# para no dejar el entorno de desarrollo local roto.
set -e

restore_native() {
  node "$(dirname "$0")/native-prebuilds.mjs"
}
trap restore_native EXIT

electron-vite build
node "$(dirname "$0")/native-prebuilds.mjs" --platform=win32 --arch=x64
electron-builder --win --x64 --publish never
