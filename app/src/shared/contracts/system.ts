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
  )
}
