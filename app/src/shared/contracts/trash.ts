import { z } from 'zod'
import { contract } from './core'

export const trashTypeSchema = z.enum(['member', 'payment', 'event', 'document', 'assembly'])
export type TrashType = z.output<typeof trashTypeSchema>

export const trashItemSchema = z.object({
  type: trashTypeSchema,
  id: z.string(),
  label: z.string(),
  detail: z.string().nullable(),
  deletedAt: z.string()
})
export type TrashItem = z.output<typeof trashItemSchema>

export const trashContracts = {
  list: contract('trash:list', z.void(), z.array(trashItemSchema)),
  restore: contract(
    'trash:restore',
    z.object({ type: trashTypeSchema, id: z.string() }),
    z.object({ ok: z.literal(true) })
  )
}
