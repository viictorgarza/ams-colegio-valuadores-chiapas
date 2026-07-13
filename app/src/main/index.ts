import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { initDb } from './core/db'
import { runSeeds } from './core/db/seeds'
import { bus } from './core/events/bus'
import * as auditModule from './modules/audit'
import * as usersModule from './modules/users'
import * as organizationModule from './modules/organization'
import * as systemModule from './modules/system'
import * as membersModule from './modules/members'
import * as catalogsModule from './modules/catalogs'
import * as paymentsModule from './modules/payments'
import * as documentsModule from './modules/documents'
import * as backupsModule from './modules/backups'
import * as eventsModule from './modules/events'
import * as assembliesModule from './modules/assemblies'
import * as updatesModule from './modules/updates'
import * as trashModule from './modules/trash'

// El orden importa solo para audit: se suscribe antes de que nadie emita.
const modules = [
  auditModule,
  usersModule,
  organizationModule,
  systemModule,
  membersModule,
  catalogsModule,
  paymentsModule,
  documentsModule,
  backupsModule,
  eventsModule,
  assembliesModule,
  updatesModule,
  trashModule
]

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 1024,
    minHeight: 680,
    title: 'AMS',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

void app.whenReady().then(() => {
  const dataDir = process.env['AMS_DATA_DIR'] ?? join(app.getPath('userData'), 'data')
  const migrationsDir = app.isPackaged
    ? join(process.resourcesPath, 'drizzle')
    : join(app.getAppPath(), 'drizzle')

  const db = initDb({ dataDir, migrationsDir })
  runSeeds(db)
  for (const m of modules) m.register()
  bus.emit('app.started', { appVersion: app.getVersion() })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
