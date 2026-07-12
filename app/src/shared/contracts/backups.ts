import { z } from 'zod'
import { contract } from './core'

export const createBackupResultSchema = z.object({
  saved: z.boolean(),
  path: z.string().nullable()
})
export type CreateBackupResult = z.output<typeof createBackupResultSchema>

export const restoreBackupResultSchema = z.object({
  status: z.enum(['restored', 'canceled', 'invalid', 'error']),
  message: z.string().nullable()
})
export type RestoreBackupResult = z.output<typeof restoreBackupResultSchema>

export const lastBackupSchema = z.object({
  destination: z.enum(['local', 'usb', 'r2']),
  finishedAt: z.string().nullable()
})
export type LastBackup = z.output<typeof lastBackupSchema>

export const backupsContracts = {
  create: contract('backups:create', z.void(), createBackupResultSchema),
  restore: contract('backups:restore', z.void(), restoreBackupResultSchema),
  getLast: contract('backups:get-last', z.void(), lastBackupSchema.nullable())
}
