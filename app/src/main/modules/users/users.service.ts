import { and, eq, isNull, ne } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
// Imports relativos a propósito: este servicio también se ejecuta fuera del bundle
// de Electron (scripts/smoke.ts con tsx), donde los alias no existen.
import { getDb } from '../../core/db'
import * as s from '../../core/db/schema'
import { hashPassword, verifyPassword } from '../../core/crypto/password'
import { bus } from '../../core/events/bus'
import type { CreateUserInput, SessionUser, User } from '../../../shared/contracts'

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

export type ChangePasswordResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: 'contrasena_actual_incorrecta' }

/** Cambia la contraseña del usuario en sesión y limpia mustChangePassword. */
export function changeOwnPassword(currentPassword: string, newPassword: string): ChangePasswordResult {
  if (!currentUser) throw new Error('No hay sesión activa.')
  const db = getDb()
  const row = db.select().from(s.users).where(eq(s.users.id, currentUser.id)).get()
  if (!row || !verifyPassword(currentPassword, row.passwordHash)) {
    return { ok: false, reason: 'contrasena_actual_incorrecta' }
  }
  db.update(s.users)
    .set({ passwordHash: hashPassword(newPassword), mustChangePassword: false, updatedAt: new Date().toISOString() })
    .where(eq(s.users.id, row.id))
    .run()
  currentUser = { ...currentUser, mustChangePassword: false }
  bus.emit('user.password_changed', { actorId: row.id, userId: row.id, username: row.username })
  return { ok: true, user: currentUser }
}

function toUser(row: typeof s.users.$inferSelect): User {
  return {
    id: row.id,
    fullName: row.fullName,
    username: row.username,
    role: row.role,
    isActive: row.isActive,
    mustChangePassword: row.mustChangePassword,
    lastLoginAt: row.lastLoginAt
  }
}

export function listUsers(): User[] {
  return getDb().select().from(s.users).where(isNull(s.users.deletedAt)).all().map(toUser)
}

export type CreateUserResult = { ok: true; user: User } | { ok: false; reason: 'usuario_repetido' }

export function createUser(input: CreateUserInput, actorId: string | null): CreateUserResult {
  const db = getDb()
  const existing = db.select({ id: s.users.id }).from(s.users).where(eq(s.users.username, input.username)).get()
  if (existing) return { ok: false, reason: 'usuario_repetido' }

  const id = uuidv7()
  db.insert(s.users)
    .values({
      id,
      fullName: input.fullName,
      username: input.username,
      passwordHash: hashPassword(input.password),
      role: input.role,
      mustChangePassword: false
    })
    .run()
  bus.emit('user.created', { actorId, userId: id, username: input.username, role: input.role })
  return { ok: true, user: toUser(db.select().from(s.users).where(eq(s.users.id, id)).get()!) }
}

export type SetUserActiveResult = { ok: true } | { ok: false; reason: 'ultimo_admin_activo' }

export function setUserActive(id: string, isActive: boolean, actorId: string | null): SetUserActiveResult {
  const db = getDb()
  const row = db.select().from(s.users).where(eq(s.users.id, id)).get()
  if (!row) return { ok: true }

  if (!isActive && row.role === 'admin') {
    const otherActiveAdmins = db
      .select({ id: s.users.id })
      .from(s.users)
      .where(and(eq(s.users.role, 'admin'), eq(s.users.isActive, true), ne(s.users.id, id)))
      .all()
    if (otherActiveAdmins.length === 0) return { ok: false, reason: 'ultimo_admin_activo' }
  }

  db.update(s.users).set({ isActive, updatedAt: new Date().toISOString() }).where(eq(s.users.id, id)).run()
  bus.emit('user.active_changed', { actorId, userId: id, username: row.username, isActive })
  return { ok: true }
}
