import { z } from 'zod'
import { contract } from './core'

export const userSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  username: z.string(),
  role: z.enum(['admin', 'secretary']),
  isActive: z.boolean(),
  mustChangePassword: z.boolean(),
  lastLoginAt: z.string().nullable()
})
export type User = z.output<typeof userSchema>

export const createUserSchema = z.object({
  fullName: z.string().trim().min(1, 'El nombre es obligatorio'),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Mínimo 3 caracteres')
    .regex(/^[a-z0-9._-]+$/, 'Solo minúsculas, números, punto, guion'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  role: z.enum(['admin', 'secretary'])
})
export type CreateUserInput = z.output<typeof createUserSchema>

const createUserResultSchema = z.union([
  z.object({ ok: z.literal(true), user: userSchema }),
  z.object({ ok: z.literal(false), reason: z.enum(['usuario_repetido']) })
])

export const updateUserSchema = z.object({
  id: z.string(),
  fullName: z.string().trim().min(1, 'El nombre es obligatorio'),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Mínimo 3 caracteres')
    .regex(/^[a-z0-9._-]+$/, 'Solo minúsculas, números, punto, guion')
})
export type UpdateUserInput = z.output<typeof updateUserSchema>

const updateUserResultSchema = z.union([
  z.object({ ok: z.literal(true), user: userSchema }),
  z.object({ ok: z.literal(false), reason: z.enum(['usuario_repetido']) })
])

export const resetPasswordSchema = z.object({
  id: z.string(),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres')
})

export const usersContracts = {
  list: contract('users:list', z.void(), z.array(userSchema)),
  create: contract('users:create', createUserSchema, createUserResultSchema),
  update: contract('users:update', updateUserSchema, updateUserResultSchema),
  resetPassword: contract('users:reset-password', resetPasswordSchema, z.object({ ok: z.literal(true) })),
  setActive: contract(
    'users:set-active',
    z.object({ id: z.string(), isActive: z.boolean() }),
    z.union([
      z.object({ ok: z.literal(true) }),
      z.object({ ok: z.literal(false), reason: z.enum(['ultimo_admin_activo']) })
    ])
  )
}
