import { randomBytes } from 'node:crypto'
import { and, eq, isNull, ne } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
// Imports relativos a propósito: este servicio también se ejecuta fuera del bundle
// de Electron (scripts/smoke.ts con tsx), donde los alias no existen.
import { getDb } from '../../core/db'
import * as s from '../../core/db/schema'
import { getSetting, setSetting } from '../../core/db/settings'
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

export type UpdateUserInput = { fullName: string; username: string }
export type UpdateUserResult = { ok: true; user: User } | { ok: false; reason: 'usuario_repetido' }

/** Edita nombre completo y/o usuario. Si la cuenta editada es la de la sesión
 * activa, refresca currentUser para que el saludo/menú reflejen el cambio sin
 * requerir volver a iniciar sesión. */
export function updateUser(id: string, input: UpdateUserInput, actorId: string | null): UpdateUserResult {
  const db = getDb()
  const existing = db
    .select({ id: s.users.id })
    .from(s.users)
    .where(and(eq(s.users.username, input.username), ne(s.users.id, id)))
    .get()
  if (existing) return { ok: false, reason: 'usuario_repetido' }

  db.update(s.users)
    .set({ fullName: input.fullName, username: input.username, updatedAt: new Date().toISOString() })
    .where(eq(s.users.id, id))
    .run()
  const updated = toUser(db.select().from(s.users).where(eq(s.users.id, id)).get()!)

  if (currentUser?.id === id) {
    currentUser = { ...currentUser, fullName: updated.fullName, username: updated.username }
  }
  bus.emit('user.updated', { actorId, userId: id, fullName: updated.fullName, username: updated.username })
  return { ok: true, user: updated }
}

/** Restablece la contraseña de otra cuenta (admin gestionando usuarios).
 * Marca mustChangePassword para forzar cambio en el siguiente login, igual
 * que las cuentas recién creadas. */
export function adminResetPassword(id: string, newPassword: string, actorId: string | null): { ok: true } {
  const db = getDb()
  const row = db.select({ username: s.users.username }).from(s.users).where(eq(s.users.id, id)).get()
  db.update(s.users)
    .set({ passwordHash: hashPassword(newPassword), mustChangePassword: true, updatedAt: new Date().toISOString() })
    .where(eq(s.users.id, id))
    .run()
  bus.emit('user.password_reset', { actorId, userId: id, username: row?.username ?? '' })
  return { ok: true }
}

// Recuperación local de acceso (redesign/ui-ux-pro-max, 2026-07-13): por diseño
// NO hay una contraseña maestra fija en el código — eso sería una puerta trasera
// que cualquiera podría extraer del instalador y usar contra cualquier instalación
// del Colegio. En su lugar, cada instalación genera su propio código aleatorio
// (visible una sola vez), guardado siempre hasheado con el mismo scrypt que las
// contraseñas. Solo un admin ya logueado puede generarlo/regenerarlo desde
// Configuración → Seguridad; se usa después, sin sesión, en la pantalla de login.
const RECOVERY_CODE_HASH_KEY = 'security.recovery_code_hash'
const RECOVERY_ATTEMPTS_KEY = 'security.recovery_failed_attempts'
const RECOVERY_LOCK_UNTIL_KEY = 'security.recovery_locked_until'
const MAX_RECOVERY_ATTEMPTS = 5
const RECOVERY_LOCKOUT_MS = 15 * 60 * 1000

function formatRecoveryCode(raw: Buffer): string {
  const hex = raw.toString('hex').toUpperCase().slice(0, 16)
  return hex.match(/.{1,4}/g)!.join('-')
}

export function hasRecoveryCode(): boolean {
  return getSetting<string | null>(RECOVERY_CODE_HASH_KEY, null) !== null
}

/** Genera (o reemplaza) el código de recuperación de esta instalación. El
 * código en texto plano se devuelve una sola vez — solo se guarda su hash. */
export function generateRecoveryCode(actorId: string | null): { code: string } {
  const code = formatRecoveryCode(randomBytes(8))
  setSetting(RECOVERY_CODE_HASH_KEY, hashPassword(code))
  setSetting(RECOVERY_ATTEMPTS_KEY, 0)
  setSetting(RECOVERY_LOCK_UNTIL_KEY, null)
  bus.emit('security.recovery_code_generated', { actorId })
  return { code }
}

export type RecoverPasswordResult =
  | { ok: true }
  | { ok: false; reason: 'sin_codigo' | 'codigo_incorrecto' | 'usuario_no_encontrado' | 'bloqueado' }

/** Restablece la contraseña de `username` si `code` coincide con el código de
 * recuperación de la instalación. Sin sesión activa (se usa desde el login).
 * Bloquea intentos tras 5 fallos por 15 minutos para frenar fuerza bruta local. */
export function recoverPasswordWithCode(code: string, username: string, newPassword: string): RecoverPasswordResult {
  const storedHash = getSetting<string | null>(RECOVERY_CODE_HASH_KEY, null)
  if (!storedHash) return { ok: false, reason: 'sin_codigo' }

  const lockedUntil = getSetting<string | null>(RECOVERY_LOCK_UNTIL_KEY, null)
  if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) {
    return { ok: false, reason: 'bloqueado' }
  }

  if (!verifyPassword(code, storedHash)) {
    const attempts = getSetting<number>(RECOVERY_ATTEMPTS_KEY, 0) + 1
    setSetting(RECOVERY_ATTEMPTS_KEY, attempts)
    if (attempts >= MAX_RECOVERY_ATTEMPTS) {
      setSetting(RECOVERY_LOCK_UNTIL_KEY, new Date(Date.now() + RECOVERY_LOCKOUT_MS).toISOString())
    }
    return { ok: false, reason: 'codigo_incorrecto' }
  }

  const db = getDb()
  const row = db.select().from(s.users).where(eq(s.users.username, username)).get()
  if (!row || row.deletedAt) return { ok: false, reason: 'usuario_no_encontrado' }

  db.update(s.users)
    .set({
      passwordHash: hashPassword(newPassword),
      mustChangePassword: false,
      isActive: true,
      updatedAt: new Date().toISOString()
    })
    .where(eq(s.users.id, row.id))
    .run()

  setSetting(RECOVERY_ATTEMPTS_KEY, 0)
  setSetting(RECOVERY_LOCK_UNTIL_KEY, null)
  bus.emit('user.password_recovered', { userId: row.id, username: row.username })
  return { ok: true }
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
