import { handle } from '@main/core/ipc/registry'
import { contracts } from '@shared/contracts'
import { getDb } from '@main/core/db'
import * as s from '@main/core/db/schema'
import * as service from './payments.service'
import { ensureReceiptPdf, generateReceiptPdf } from './receipt'
import { openStoredFile, saveStoredFileAs } from '../documents/documents.files'
import { me } from '../users/users.service'

const actor = (): string | null => me()?.id ?? null

async function resolveReceiptPath(paymentId: string): Promise<string> {
  const found = service.getPaymentWithMember(paymentId)
  if (!found) throw new Error('El pago no existe o está en la papelera')
  if (!found.payment.receiptFolio) throw new Error('Este pago no tiene recibo (no es un pago en efectivo/transferencia)')
  const org = getDb().select().from(s.organization).limit(1).get()
  return ensureReceiptPdf(found.payment, found.memberFullName, found.memberNumber, org?.name ?? 'AMS')
}

export function register(): void {
  handle(contracts.payments.annuitiesByYear, ({ year }) => service.annuitiesByYear(year))
  handle(contracts.payments.listByMember, ({ memberId }) => service.listPaymentsByMember(memberId))
  handle(contracts.payments.getAnnualFee, ({ year }) => service.getAnnualFee(year))
  handle(contracts.payments.setAnnualFee, (input) => service.setAnnualFee(input, actor()))

  handle(contracts.payments.create, async (input) => {
    const { payment, memberFullName, memberNumber } = service.createPayment(input, actor())
    let receiptPath: string | null = null
    if (payment.kind === 'pago') {
      const org = getDb().select().from(s.organization).limit(1).get()
      receiptPath = await generateReceiptPdf(payment, memberFullName, memberNumber, org?.name ?? 'AMS')
    }
    return { payment, receiptPath }
  })

  handle(contracts.payments.remove, ({ id }) => {
    service.removePayment(id, actor())
    return { ok: true as const }
  })

  handle(contracts.payments.openReceipt, async ({ id }) => {
    const path = await resolveReceiptPath(id)
    await openStoredFile(path)
    return { ok: true as const }
  })

  handle(contracts.payments.downloadReceipt, async ({ id }) => {
    const path = await resolveReceiptPath(id)
    const found = service.getPaymentWithMember(id)!
    const saved = await saveStoredFileAs(path, `Recibo-${found.payment.receiptFolio}.pdf`)
    return { path: saved }
  })
}
