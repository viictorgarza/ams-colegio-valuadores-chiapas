import { eq } from 'drizzle-orm'
// Imports relativos a propósito: este servicio también se ejecuta fuera del bundle
// de Electron (scripts/smoke.ts con tsx), donde los alias no existen.
import { getDb } from '../../core/db'
import * as s from '../../core/db/schema'
import { verifyPassword } from '../../core/crypto/password'
import { bus } from '../../core/events/bus'
import type { SessionUser } from '../../../shared/contracts'

export type LoginResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: 'credenciales_invalidas' | 'usuario_inactivo' }

let currentUser: SessionUser | null = null

export function login(username: string, password: string): LoginResult {
  const db = getDb()
  const rows = db.select().from(s.users).where(eq(s.users.username, username)).all()
  const user = rows[0]

  if (!user || user.deletedAt || !verifyPassword(password, user.passwordHash)) {
    bus.emit('auth.login', { username, userId: user?.id ?? null, success: false })
    return { ok: false, reason: 'credenciales_invalidas' }
  }
  if (!user.isActive) {
    bus.emit('auth.login', { username, userId: user.id, success: false })
    return { ok: false, reason: 'usuario_inactivo' }
  }

  db.update(s.users)
    .set({ lastLoginAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(s.users.id, user.id))
    .run()

  currentUser = {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    mustChangePassword: user.mustChangePassword
  }
  bus.emit('auth.login', { username, userId: user.id, success: true })
  return { ok: true, user: currentUser }
}

export function me(): SessionUser | null {
  return currentUser
}

export function logout(): void {
  if (currentUser) {
    bus.emit('auth.logout', { userId: currentUser.id })
  }
  currentUser = null
}
