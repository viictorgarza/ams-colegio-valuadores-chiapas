import { Hono } from 'hono'
import type { AppContext } from '../env'
import { ApiError } from '../env'
import { bearerToken, createSession, destroySession, hashPassword, requireAuth, userForToken, verifyPassword } from '../auth'
import { changePasswordSchema, loginSchema } from '../schemas'
import { audit } from '../audit'
import { nowIso } from '../util'

export const authRoutes = new Hono<AppContext>()

authRoutes.post('/login', async (c) => {
  const input = loginSchema.parse(await c.req.json())
  const row = await c.env.DB.prepare(
    `SELECT id, full_name, username, password_hash, role, must_change_password
     FROM users WHERE username = ? AND is_active = 1 AND deleted_at IS NULL`
  )
    .bind(input.username)
    .first<{
      id: string
      full_name: string
      username: string
      password_hash: string
      role: 'admin' | 'secretary'
      must_change_password: number
    }>()

  if (!row || !(await verifyPassword(input.password, row.password_hash))) {
    throw new ApiError(401, 'Usuario o contraseña incorrectos')
  }

  const token = await createSession(c.env.DB, row.id)
  await c.env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(nowIso(), row.id).run()
  await audit(c.env.DB, { userId: row.id, action: 'sesion.inicio', entityType: 'user', entityId: row.id })

  return c.json({
    token,
    user: {
      id: row.id,
      fullName: row.full_name,
      username: row.username,
      role: row.role,
      mustChangePassword: row.must_change_password === 1
    }
  })
})

authRoutes.post('/logout', async (c) => {
  const token = bearerToken(c.req.header('Authorization'))
  if (token) {
    const user = await userForToken(c.env.DB, token)
    await destroySession(c.env.DB, token)
    if (user) await audit(c.env.DB, { userId: user.id, action: 'sesion.cierre', entityType: 'user', entityId: user.id })
  }
  return c.json({ ok: true })
})

authRoutes.get('/me', requireAuth, (c) => c.json({ user: c.get('user') }))

authRoutes.post('/change-password', requireAuth, async (c) => {
  const user = c.get('user')
  const input = changePasswordSchema.parse(await c.req.json())
  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(user.id)
    .first<{ password_hash: string }>()
  if (!row || !(await verifyPassword(input.currentPassword, row.password_hash))) {
    throw new ApiError(400, 'La contraseña actual no es correcta')
  }
  await c.env.DB.prepare(
    'UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?'
  )
    .bind(await hashPassword(input.newPassword), nowIso(), user.id)
    .run()
  await audit(c.env.DB, { userId: user.id, action: 'usuario.cambio_contrasena', entityType: 'user', entityId: user.id })
  return c.json({ ok: true })
})
