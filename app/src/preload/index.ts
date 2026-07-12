import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { allowedChannels } from '@shared/contracts'

const allowed = allowedChannels()

// Puente mínimo (docs/02 §2): sin lógica; solo pasa mensajes de canales conocidos.
// getPathForFile es la única excepción — no es un canal IPC, es la API de Electron
// para resolver la ruta real de un archivo soltado (drag & drop) desde el renderer.
contextBridge.exposeInMainWorld('ams', {
  invoke: (channel: string, payload: unknown): Promise<unknown> => {
    if (!allowed.has(channel)) {
      return Promise.reject(new Error(`Canal IPC no permitido: ${channel}`))
    }
    return ipcRenderer.invoke(channel, payload)
  },
  getPathForFile: (file: File): string => webUtils.getPathForFile(file)
})
