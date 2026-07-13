import { app, BrowserWindow, dialog } from 'electron'
import PDFDocument from 'pdfkit'
import { copyFileSync, createWriteStream, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CloudConfigStatus } from '@shared/contracts'

/**
 * Kit de recuperación imprimible (M4/E-07, cierre 2026-07): una hoja para
 * guardar fuera de la laptop con la ruta de los respaldos y los pasos de
 * restauración. No imprime contraseñas ni llaves — esas no se vuelven a
 * mostrar una vez guardadas (mismo criterio que el resto de M4).
 */
export async function generateRecoveryKit(
  orgName: string,
  cloud: CloudConfigStatus,
  dataDir: string
): Promise<string | null> {
  const now = new Date()
  const dateLabel = now.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

  const tmpDir = mkdtempSync(join(tmpdir(), 'ams-kit-recuperacion-'))
  const tmpPath = join(tmpDir, 'kit-recuperacion.pdf')

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'letter', margin: 56 })
    const stream = createWriteStream(tmpPath)
    doc.pipe(stream)
    stream.on('finish', resolve)
    stream.on('error', reject)

    doc.fontSize(16).fillColor('#163EAB').text('Kit de recuperación', { align: 'left' })
    doc.fontSize(11).fillColor('#566175').text(orgName)
    doc.fontSize(9).fillColor('#8A94A8').text(`Generado el ${dateLabel}`)
    doc.moveDown(1.2)

    function section(title: string): void {
      doc.moveDown(0.6)
      doc.fontSize(12).fillColor('#1A2130').text(title)
      doc.moveTo(doc.x, doc.y + 2).lineTo(doc.page.width - doc.page.margins.right, doc.y + 2).stroke('#C7CDDA')
      doc.moveDown(0.5)
      doc.fontSize(10).fillColor('#1A2130')
    }

    function blankLine(label: string): void {
      doc.fontSize(9.5).fillColor('#566175').text(label)
      const startX = doc.x
      const y = doc.y + 2
      doc.moveTo(startX, y + 12).lineTo(doc.page.width - doc.page.margins.right, y + 12).stroke('#C7CDDA')
      doc.moveDown(1.4)
    }

    section('Dónde están los respaldos')
    doc.text(`Base de datos local: ${join(dataDir, 'ams.db')}`)
    doc.text(
      cloud.configured
        ? `Respaldo en la nube: Cloudflare R2, bucket "${cloud.bucket}" (cuenta ${cloud.accountId}).`
        : 'Respaldo en la nube: sin configurar todavía (Configuración → Respaldos).'
    )
    doc.moveDown(0.4)
    blankLine('Ubicación del USB o copia física de respaldo (anotar a mano):')
    blankLine('Quién tiene acceso a la cuenta de Cloudflare / correo del administrador:')

    section('Cómo restaurar un respaldo')
    doc.text('1. Abre AMS con las credenciales de administrador.', { indent: 10 })
    doc.text('2. Ve a Configuración → Respaldos.', { indent: 10 })
    doc.text('3. Pulsa "Restaurar desde archivo…" y elige el respaldo (.db) más reciente.', { indent: 10 })
    doc.text('4. Confirma. La aplicación se reinicia sola con los datos restaurados.', { indent: 10 })
    doc.moveDown(0.3)
    doc.fontSize(9).fillColor('#8A94A8').text('Si el respaldo está en R2, descárgalo primero desde el bucket antes del paso 3.')

    section('Contraseñas y accesos')
    doc.fontSize(10).fillColor('#1A2130').text(
      'Por seguridad, este documento no incluye contraseñas ni llaves de acceso. ' +
        'Guarda esa información aparte, en un lugar seguro y separado de este papel.'
    )

    doc.end()
  })

  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]!
  const pick = await dialog.showSaveDialog(win, {
    title: 'Guardar kit de recuperación',
    defaultPath: join(app.getPath('documents'), `AMS_Kit_Recuperacion_${now.toISOString().slice(0, 10)}.pdf`)
  })
  if (pick.canceled || !pick.filePath) return null
  copyFileSync(tmpPath, pick.filePath)
  return pick.filePath
}
