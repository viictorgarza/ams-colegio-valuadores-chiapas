import { z } from 'zod'
import { contract } from './core'

export const sessionUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  fullName: z.string(),
  role: z.enum(['admin', 'secretary']),
  mustChangePassword: z.boolean()
})

export type SessionUser = z.output<typeof sessionUserSchema>

const loginResultSchema = z.union([
  z.object({ ok: z.literal(true), user: sessionUserSchema }),
  z.object({ ok: z.literal(false), reason: z.enum(['credenciales_invalidas', 'usuario_inactivo']) })
])

export const authContracts = {
  login: contract(
    'auth:login',
    z.object({ username: z.string().trim().min(1), password: z.string().min(1) }),
    loginResultSchema
  ),
  me: contract('auth:me', z.void(), sessionUserSchema.nullable()),
  logout: contract('auth:logout', z.void(), z.object({ ok: z.literal(true) }))
}
