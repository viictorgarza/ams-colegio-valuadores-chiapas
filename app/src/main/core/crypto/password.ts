import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

// scrypt de node:crypto en lugar de argon2: evita un segundo módulo nativo que
// recompilar por versión de Electron (better-sqlite3 ya es suficiente riesgo de build).
// Parámetros según guía OWASP para scrypt (N=2^15, r=8, p=1).
const N = 1 << 15
const R = 8
const P = 1
const KEY_LENGTH = 64
const MAX_MEM = 128 * 1024 * 1024

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: MAX_MEM })
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, nStr, rStr, pStr, saltB64, hashB64] = parts
  if (!nStr || !rStr || !pStr || !saltB64 || !hashB64) return false
  const salt = Buffer.from(saltB64, 'base64')
  const expected = Buffer.from(hashB64, 'base64')
  const actual = scryptSync(password, salt, expected.length, {
    N: Number(nStr),
    r: Number(rStr),
    p: Number(pStr),
    maxmem: MAX_MEM
  })
  return timingSafeEqual(actual, expected)
}
