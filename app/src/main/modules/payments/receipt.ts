import { app } from 'electron'
import PDFDocument from 'pdfkit'
import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Payment } from '../../../shared/contracts'

const KIND_LABEL: Record<string, string> = {
  pago: 'Pago',
  apoyo_en_especie: 'Apoyo en especie',
  condonacion: 'Condonación'
}

/** Ruta determinística del PDF de un recibo (mismo cálculo usado al generarlo). */
export function receiptFilePath(payment: Payment): string {
  const dir = join(app.getPath('userData'), 'data', 'recibos')
  const fileName = `${payment.receiptFolio ?? payment.id}.pdf`
  return join(dir, fileName)
}

/**
 * Ruta del PDF de un recibo ya existente, regenerándolo si por alguna razón
 * el archivo no está (p. ej. se movió o borró el userData a mano).
 */
export async function ensureReceiptPdf(
  payment: Payment,
  memberFullName: string,
  memberNumber: string,
  orgName: string
): Promise<string> {
  const path = receiptFilePath(payment)
  if (existsSync(path)) return path
  return generateReceiptPdf(payment, memberFullName, memberNumber, orgName)
}

/**
 * Recibo simple con folio (docs/03 §4.4, docs/05 M2). Diseño visual definitivo
 * pendiente de Victor — esta es una versión funcional en texto plano formal.
 */
export async function generateReceiptPdf(
  payment: Payment,
  memberFullName: string,
  memberNumber: string,
  orgName: string
): Promise<string> {
  const dir = join(app.getPath('userData'), 'data', 'recibos')
  mkdirSync(dir, { recursive: true })
  const fileName = `${payment.receiptFolio ?? payment.id}.pdf`
  const filePath = join(dir, fileName)

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'letter', margin: 56 })
    const stream = createWriteStream(filePath)
    doc.pipe(stream)
    stream.on('finish', resolve)
    stream.on('error', reject)

    doc.fontSize(14).fillColor('#163EAB').text(orgName, { align: 'center' })
    doc.moveDown(0.3)
    doc.fontSize(11).fillColor('#1A2130').text('Recibo de pago de anualidad', { align: 'center' })
    doc.moveDown(1.2)

    if (payment.receiptFolio) {
      doc.fontSize(10).fillColor('#566175').text(`Folio: ${payment.receiptFolio}`, { align: 'right' })
    }
    doc.text(`Fecha: ${payment.paidAt}`, { align: 'right' })
    doc.moveDown(1)

    doc.fontSize(11).fillColor('#1A2130')
    doc.text(`Miembro: ${memberFullName} (${memberNumber})`)
    doc.text(`Concepto: Anualidad ${payment.year}`)
    doc.text(`Tipo: ${KIND_LABEL[payment.kind] ?? payment.kind}`)
    if (payment.method) doc.text(`Método: ${payment.method}`)
    if (payment.reference) doc.text(`Referencia: ${payment.reference}`)
    doc.moveDown(0.6)
    doc.fontSize(16).fillColor('#163EAB').text(`Monto: $${(payment.amountCents / 100).toFixed(2)} MXN`)

    if (payment.observations) {
      doc.moveDown(0.8)
      doc.fontSize(10).fillColor('#566175').text(`Observaciones: ${payment.observations}`)
    }

    doc.moveDown(2)
    doc.fontSize(9).fillColor('#8A94A8').text('Documento generado por el sistema AMS.', { align: 'center' })
    doc.end()
  })

  return filePath
}
