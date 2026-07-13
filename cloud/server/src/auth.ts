import type { MiddlewareHandler } from 'hono'
import type { AppContext, SessionUser } from './env'
import { ApiError } from './env'
import { fromBase64, nowIso, sha256Hex, toBase64, uuidv7 } from './util'

// PBKDF2-SHA256 (Workers no tienen scrypt como el escritorio; mismo formato
// autodescriptivo: pbkdf2$<iteraciones>$<salt b64>$<hash b64>).
const ITERATIONS = 100_000
const SESSION_DAYS = 30

async function deriveBits(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits'
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256
  )
  return new Uint8Array(bits)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await deriveBits(password, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterStr, saltB64, hashB64] = stored.split('$')
  if (scheme !== 'pbkdf2' || !iterStr || !saltB64 || !hashB64) return false
  const expected = fromBase64(hashB64)
  const actual = await deriveBits(password, fromBase64(saltB64), Number(iterStr))
  if (actual.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!
  return diff === 0
}

export async function createSession(db: D1Database, userId: string): Promise<string> {
  const raw = new Uint8Array(32)
  crypto.getRandomValues(raw)
  const token = Array.from(raw, (b) => b.toString(16).padStart(2, '0')).join('')
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString()
  await db
    .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(token), userId, nowIso(), expires)
    .run()
  return token
}

export async function destroySession(db: D1Database, token: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run()
}

export async function userForToken(db: D1Database, token: string): Promise<SessionUser | null> {
  const row = await db
    .prepare(
      `SELECT u.id, u.full_name, u.username, u.role, u.must_change_password, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND u.is_active = 1 AND u.deleted_at IS NULL`
    )
    .bind(await sha256Hex(token))
    .first<{
      id: string
      full_name: string
      username: string
      role: 'admin' | 'secretary'
      must_change_password: number
      expires_at: string
    }>()
  if (!row) return null
  if (row.expires_at < nowIso()) {
    await destroySession(db, token)
    return null
  }
  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    role: row.role,
    mustChangePassword: row.must_change_password === 1
  }
}

export function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null
  return header.slice(7).trim() || null
}

/** Middleware: exige sesión válida y deja al usuario en c.get('user'). */
export const requireAuth: MiddlewareHandler<AppContext> = async (c, next) => {
  const token = bearerToken(c.req.header('Authorization'))
  const user = token ? await userForToken(c.env.DB, token) : null
  if (!user) throw new ApiError(401, 'Sesión inválida o expirada')
  c.set('user', user)
  await next()
}

export { uuidv7 }
