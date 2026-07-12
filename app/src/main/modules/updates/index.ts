import { app, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'

/**
 * Auto-actualización (Fase E, docs/05): lee GitHub Releases (repo público) vía
 * app-update.yml que electron-builder genera solo al empaquetar. Solo se activa
 * en producción — en dev no hay app-update.yml y el check fallaría sin sentido.
 * Silenciosa por diseño (Angélica no es técnica): sin diálogos de error ni de
 * "buscando actualización" — solo se le pregunta algo cuando ya hay una lista
 * para instalar. Si no hay internet (la oficina no tiene), falla callado y ya.
 */
export function register(): void {
  if (!app.isPackaged) return

  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', (info) => {
    void dialog
      .showMessageBox({
        type: 'info',
        title: 'Actualización lista',
        message: `Hay una nueva versión de AMS (${info.version}) lista para instalarse.`,
        detail: 'Se puede instalar ahora (la app se reinicia) o al cerrar la app la próxima vez.',
        buttons: ['Reiniciar ahora', 'Después'],
        defaultId: 0,
        cancelId: 1
      })
      .then((result) => {
        if (result.response === 0) autoUpdater.quitAndInstall()
      })
  })

  autoUpdater.on('error', (err) => {
    console.error('[auto-update]', err.message)
  })

  // Espera a que la ventana principal esté cargada para no competir con el arranque.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => console.error('[auto-update] check falló:', err.message))
  }, 10_000)
}
