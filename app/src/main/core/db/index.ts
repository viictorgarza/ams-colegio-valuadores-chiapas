import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import * as schema from './schema'

export type Db = BetterSQLite3Database<typeof schema>

let _db: Db | null = null
let _sqlite: Database.Database | null = null

export interface DbInitOptions {
  dataDir: string
  migrationsDir: string
}

export function initDb(opts: DbInitOptions): Db {
  mkdirSync(opts.dataDir, { recursive: true })
  const sqlite = new Database(join(opts.dataDir, 'ams.db'))
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: opts.migrationsDir })
  ensureFts(sqlite)
  _db = db
  _sqlite = sqlite
  return db
}

export function getDb(): Db {
  if (!_db) throw new Error('La base de datos no está inicializada')
  return _db
}

export function getSqlite(): Database.Database {
  if (!_sqlite) throw new Error('La base de datos no está inicializada')
  return _sqlite
}

export function closeDb(): void {
  _sqlite?.close()
  _db = null
  _sqlite = null
}

const FTS_COLUMNS =
  'member_id, full_name, member_number, curp, rfc, email, phone, company, university, specialty, degree'
const FTS_NEW_VALUES = `new.id, new.full_name, new.member_number, coalesce(new.curp,''), coalesce(new.rfc,''),
      coalesce(new.email,''), coalesce(new.phone,''), coalesce(new.company,''), coalesce(new.university,''),
      coalesce(new.specialty,''), coalesce(new.degree,'')`

/**
 * Índice de búsqueda inmediata (docs/03 §5). Idempotente: se asegura en cada arranque,
 * fuera de las migraciones, porque las tablas virtuales FTS5 no son parte del modelo relacional.
 */
function ensureFts(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS members_fts USING fts5(
      ${FTS_COLUMNS},
      tokenize = 'unicode61 remove_diacritics 2'
    );
    CREATE TRIGGER IF NOT EXISTS members_fts_ai AFTER INSERT ON members BEGIN
      INSERT INTO members_fts(${FTS_COLUMNS}) VALUES (${FTS_NEW_VALUES});
    END;
    CREATE TRIGGER IF NOT EXISTS members_fts_ad AFTER DELETE ON members BEGIN
      DELETE FROM members_fts WHERE member_id = old.id;
    END;
    CREATE TRIGGER IF NOT EXISTS members_fts_au AFTER UPDATE ON members BEGIN
      DELETE FROM members_fts WHERE member_id = old.id;
      INSERT INTO members_fts(${FTS_COLUMNS}) VALUES (${FTS_NEW_VALUES});
    END;
  `)
}
