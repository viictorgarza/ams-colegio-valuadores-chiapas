import { app, BrowserWindow, dialog } from 'electron'
import PDFDocument from 'pdfkit'
import { createWriteStream, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { copyFileSync } from 'node:fs'

const MONTHS_ES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
]

const COLS = [
  { label: 'No.', width: 30 },
  { label: 'Nombre', width: 170 },
  { label: 'Número Celular', width: 90 },
  { label: 'Correo Electrónico', width: 140 },
  { label: 'Firma', width: 70 }
]

/**
 * Formato de asistencia en blanco (docs/05 — módulo de Asistencias, 2026-07-12),
 * replica el layout del Excel físico que ya usaba el Colegio: mismo membrete,
 * mismas columnas, filas vacías. Solo la fecha/mes se generan solas; el resto
 * se llena a mano en la reunión, igual que siempre.
 */
export async function generateBlankAttendanceSheet(orgName: string): Promise<string | null> {
  const now = new Date()
  const dateLabel = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
  const monthLabel = `${MONTHS_ES[now.getMonth()]} ${now.getFullYear()}`

  const tmpDir = mkdtempSync(join(tmpdir(), 'ams-asistencia-'))
  const tmpPath = join(tmpDir, 'lista-asistencia.pdf')

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'letter', margin: 40, layout: 'landscape' })
    const stream = createWriteStream(tmpPath)
    doc.pipe(stream)
    stream.on('finish', resolve)
    stream.on('error', reject)

    doc.fontSize(13).fillColor('#163EAB').text(orgName.toUpperCase(), { align: 'center' })
    doc.moveDown(0.4)
    doc.fontSize(9).fillColor('#566175').text(`FECHA: ${dateLabel}`, { align: 'right' })
    doc.moveDown(0.3)
    doc.fontSize(11).fillColor('#1A2130').text(`LISTA DE ASISTENCIA ASAMBLEA GENERAL MES: ${monthLabel}`, {
      align: 'center'
    })
    doc.moveDown(0.4)
    doc.fontSize(10).fillColor('#1A2130').text('A G R E M I A D O S', { align: 'center' })
    doc.moveDown(0.8)

    const startX = doc.page.margins.left
    let y = doc.y
    const rowHeight = 20
    const headerHeight = 18

    function drawHeader(atY: number): number {
      let x = startX
      doc.fontSize(8.5).fillColor('#1A2130')
      for (const col of COLS) {
        doc.rect(x, atY, col.width, headerHeight).stroke('#8A94A8')
        doc.text(col.label, x + 3, atY + 5, { width: col.width - 6 })
        x += col.width
      }
      return atY + headerHeight
    }

    y = drawHeader(y)

    const pageBottom = doc.page.height - doc.page.margins.bottom
    let rowNumber = 1

    while (rowNumber <= 40) {
      if (y + rowHeight > pageBottom) {
        doc.addPage({ size: 'letter', margin: 40, layout: 'landscape' })
        y = doc.page.margins.top
        y = drawHeader(y)
      }
      let x = startX
      for (let i = 0; i < COLS.length; i++) {
        const col = COLS[i]!
        doc.rect(x, y, col.width, rowHeight).stroke('#C7CDDA')
        if (i === 0) {
          doc.fontSize(8.5).fillColor('#566175').text(String(rowNumber), x + 3, y + 6, { width: col.width - 6 })
        }
        x += col.width
      }
      y += rowHeight
      rowNumber++
    }

    doc.end()
  })

  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]!
  const pick = await dialog.showSaveDialog(win, {
    title: 'Guardar formato de asistencia',
    defaultPath: join(app.getPath('documents'), `Lista_Asistencia_${now.toISOString().slice(0, 10)}.pdf`)
  })
  if (pick.canceled || !pick.filePath) return null
  copyFileSync(tmpPath, pick.filePath)
  return pick.filePath
}

const ATTENDANCE_COLS = [
  { label: 'No.', width: 30 },
  { label: 'Nombre', width: 190 },
  { label: 'Número Celular', width: 90 },
  { label: 'Correo Electrónico', width: 140 },
  { label: 'Asistencia', width: 60 }
]

/**
 * Lista de asistencia con los datos reales de quién asistió a una asamblea
 * específica (a diferencia del formato en blanco, que se llena a mano).
 */
export async function generateAttendanceSheet(
  orgName: string,
  assembly: { date: string; title: string | null },
  rows: Array<{
    memberNumber: string
    title: string | null
    apellidos: string | null
    givenNames: string
    phone: string | null
    email: string | null
    present: boolean
  }>
): Promise<string | null> {
  const [y, m, d] = assembly.date.split('-').map(Number)
  const assemblyDate = new Date(y!, m! - 1, d!)
  const dateLabel = `${String(assemblyDate.getDate()).padStart(2, '0')}/${String(assemblyDate.getMonth() + 1).padStart(2, '0')}/${assemblyDate.getFullYear()}`
  const monthLabel = `${MONTHS_ES[assemblyDate.getMonth()]} ${assemblyDate.getFullYear()}`
  const presentCount = rows.filter((r) => r.present).length

  const tmpDir = mkdtempSync(join(tmpdir(), 'ams-asistencia-'))
  const tmpPath = join(tmpDir, 'lista-asistencia.pdf')

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'letter', margin: 40, layout: 'landscape' })
    const stream = createWriteStream(tmpPath)
    doc.pipe(stream)
    stream.on('finish', resolve)
    stream.on('error', reject)

    doc.fontSize(13).fillColor('#163EAB').text(orgName.toUpperCase(), { align: 'center' })
    doc.moveDown(0.4)
    doc.fontSize(9).fillColor('#566175').text(`FECHA: ${dateLabel}`, { align: 'right' })
    doc.moveDown(0.3)
    doc
      .fontSize(11)
      .fillColor('#1A2130')
      .text(`LISTA DE ASISTENCIA ASAMBLEA GENERAL MES: ${monthLabel}`, { align: 'center' })
    if (assembly.title) {
      doc.moveDown(0.2)
      doc.fontSize(9.5).fillColor('#566175').text(assembly.title, { align: 'center' })
    }
    doc.moveDown(0.3)
    doc.fontSize(9).fillColor('#566175').text(`${presentCount} de ${rows.length} presentes`, { align: 'center' })
    doc.moveDown(0.6)

    const startX = doc.page.margins.left
    let y = doc.y
    const rowHeight = 20
    const headerHeight = 18

    function drawHeader(atY: number): number {
      let x = startX
      doc.fontSize(8.5).fillColor('#1A2130')
      for (const col of ATTENDANCE_COLS) {
        doc.rect(x, atY, col.width, headerHeight).stroke('#8A94A8')
        doc.text(col.label, x + 3, atY + 5, { width: col.width - 6 })
        x += col.width
      }
      return atY + headerHeight
    }

    y = drawHeader(y)

    const pageBottom = doc.page.height - doc.page.margins.bottom

    rows.forEach((row, index) => {
      if (y + rowHeight > pageBottom) {
        doc.addPage({ size: 'letter', margin: 40, layout: 'landscape' })
        y = doc.page.margins.top
        y = drawHeader(y)
      }
      const cells = [
        String(index + 1),
        [row.title, row.apellidos, row.givenNames].filter(Boolean).join(' '),
        row.phone ?? '—',
        row.email ?? '—',
        row.present ? 'Presente' : 'Ausente'
      ]
      let x = startX
      for (let i = 0; i < ATTENDANCE_COLS.length; i++) {
        const col = ATTENDANCE_COLS[i]!
        doc.rect(x, y, col.width, rowHeight).stroke('#C7CDDA')
        doc
          .fontSize(8.5)
          .fillColor(i === 4 ? (row.present ? '#1E8E5A' : '#B3372B') : '#1A2130')
          .text(cells[i]!, x + 3, y + 6, { width: col.width - 6, ellipsis: true })
        x += col.width
      }
      y += rowHeight
    })

    doc.end()
  })

  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]!
  const pick = await dialog.showSaveDialog(win, {
    title: 'Guardar lista de asistencia',
    defaultPath: join(app.getPath('documents'), `Asistencia_${assembly.date}.pdf`)
  })
  if (pick.canceled || !pick.filePath) return null
  copyFileSync(tmpPath, pick.filePath)
  return pick.filePath
}
