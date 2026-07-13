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

export const cloudConfigStatusSchema = z.object({
  configured: z.boolean(),
  accountId: z.string().nullable(),
  bucket: z.string().nullable()
})
export type CloudConfigStatus = z.output<typeof cloudConfigStatusSchema>

export const setCloudConfigInputSchema = z.object({
  accountId: z.string().trim().min(1).nullable(),
  accessKeyId: z.string().trim().min(1).nullable(),
  secretAccessKey: z.string().trim().min(1).nullable(),
  bucket: z.string().trim().min(1).nullable()
})
export type SetCloudConfigInput = z.output<typeof setCloudConfigInputSchema>

export const testCloudConnectionResultSchema = z.object({
  ok: z.boolean(),
  message: z.string()
})
export type TestCloudConnectionResult = z.output<typeof testCloudConnectionResultSchema>

export const createCloudBackupResultSchema = z.object({
  ok: z.boolean(),
  message: z.string()
})
export type CreateCloudBackupResult = z.output<typeof createCloudBackupResultSchema>

export const generateRecoveryKitResultSchema = z.object({
  saved: z.boolean(),
  path: z.string().nullable()
})
export type GenerateRecoveryKitResult = z.output<typeof generateRecoveryKitResultSchema>

export const backupsContracts = {
  create: contract('backups:create', z.void(), createBackupResultSchema),
  restore: contract('backups:restore', z.void(), restoreBackupResultSchema),
  getLast: contract('backups:get-last', z.void(), lastBackupSchema.nullable()),
  getCloudConfig: contract('backups:get-cloud-config', z.void(), cloudConfigStatusSchema),
  setCloudConfig: contract('backups:set-cloud-config', setCloudConfigInputSchema, z.object({ ok: z.literal(true) })),
  testCloudConnection: contract('backups:test-cloud-connection', z.void(), testCloudConnectionResultSchema),
  createCloudBackup: contract('backups:create-cloud', z.void(), createCloudBackupResultSchema),
  getLastCloudBackup: contract('backups:get-last-cloud', z.void(), lastBackupSchema.nullable()),
  generateRecoveryKit: contract('backups:generate-recovery-kit', z.void(), generateRecoveryKitResultSchema)
}
