import { z } from 'zod'
import { contract } from './core'

export const systemContracts = {
  info: contract(
    'system:info',
    z.void(),
    z.object({
      appVersion: z.string(),
      tableCount: z.number(),
      memberCount: z.number(),
      userCount: z.number(),
      documentTypeCount: z.number(),
      requiredDocumentTypes: z.array(z.string())
    })
  ),
  firstRunPending: contract('system:first-run-pending', z.void(), z.boolean()),
  completeFirstRun: contract('system:complete-first-run', z.void(), z.object({ ok: z.literal(true) })),
  getAutoLockMinutes: contract('system:get-auto-lock-minutes', z.void(), z.number()),
  setAutoLockMinutes: contract(
    'system:set-auto-lock-minutes',
    z.object({ minutes: z.number().int().min(0).max(240) }),
    z.object({ ok: z.literal(true) })
  )
}
