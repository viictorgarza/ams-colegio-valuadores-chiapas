-- Esquema espejo del SQLite local de la app de escritorio (app/src/main/core/db/schema.ts),
-- subconjunto MVP para la nube: miembros, anualidades/pagos, calendario, asambleas,
-- organización, usuarios, settings y auditoría. Documentos/archivos = fase 2 (requieren R2).
-- Convenciones idénticas: UUID texto como PK, timestamps ISO-8601 UTC, borrado lógico
-- con deleted_at, dinero en centavos.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'secretary')),
  is_active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);

-- Sesiones de la API (no existe en el escritorio: ahí la sesión vive en memoria).
-- Se guarda el SHA-256 del token, nunca el token mismo.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE organization (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,
  rfc TEXT,
  street TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  fiscal_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL -- JSON
);

CREATE TABLE membership_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_fee_exempt INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE member_statuses (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  member_number TEXT NOT NULL,
  title TEXT,
  given_names TEXT NOT NULL,
  paternal_surname TEXT,
  maternal_surname TEXT,
  full_name TEXT NOT NULL,
  curp TEXT,
  rfc TEXT,
  email TEXT,
  phone TEXT,
  phone_home TEXT,
  street TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  university TEXT,
  degree TEXT,
  specialty TEXT,
  masters TEXT,
  doctorate TEXT,
  company TEXT,
  position TEXT,
  is_perito INTEGER NOT NULL DEFAULT 0,
  perito_number TEXT,
  membership_type_id TEXT NOT NULL REFERENCES membership_types(id),
  status_id TEXT NOT NULL REFERENCES member_statuses(id),
  joined_at TEXT,
  observations TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE UNIQUE INDEX uq_members_member_number ON members(member_number);
CREATE UNIQUE INDEX uq_members_curp ON members(curp);
CREATE INDEX idx_members_full_name ON members(full_name);
CREATE INDEX idx_members_status ON members(status_id);

CREATE TABLE member_status_history (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  status_id TEXT NOT NULL REFERENCES member_statuses(id),
  changed_at TEXT NOT NULL,
  reason TEXT,
  changed_by TEXT REFERENCES users(id)
);
CREATE INDEX idx_msh_member ON member_status_history(member_id);

CREATE TABLE annual_fees (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  membership_type_id TEXT REFERENCES membership_types(id),
  amount_cents INTEGER NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_fees_year ON annual_fees(year);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  year INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'pago' CHECK (kind IN ('pago', 'apoyo_en_especie', 'condonacion')),
  amount_cents INTEGER NOT NULL DEFAULT 0,
  paid_at TEXT NOT NULL,
  method TEXT CHECK (method IN ('efectivo', 'transferencia', 'otro')),
  concept TEXT, -- NULL = cuota anual (cuenta para el estado de anualidad)
  reference TEXT,
  receipt_folio TEXT,
  observations TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE INDEX idx_payments_member_year ON payments(member_id, year);
CREATE INDEX idx_payments_year ON payments(year);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'otro' CHECK (event_type IN ('reunion', 'asamblea', 'ponencia', 'otro')),
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  location TEXT,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);
CREATE INDEX idx_events_starts_at ON events(starts_at);

CREATE TABLE assemblies (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  title TEXT,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT
);

CREATE TABLE attendance_records (
  id TEXT PRIMARY KEY,
  assembly_id TEXT NOT NULL REFERENCES assemblies(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  present INTEGER NOT NULL DEFAULT 0,
  marked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX uq_attendance_assembly_member ON attendance_records(assembly_id, member_id);
CREATE INDEX idx_attendance_assembly ON attendance_records(assembly_id);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  device TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_audit_created ON audit_log(created_at);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);

-- ── Semillas (mismos valores que app/src/main/core/db/seeds.ts) ──────────────
-- UUIDs fijos para poder referenciarlos desde el código y el importador.

INSERT INTO organization (id, name, short_name, city, state, country) VALUES
  ('01900000-0000-7000-8000-00000000or01',
   'Colegio de Especialistas en Valuación Profesional de Chiapas A.C.',
   'CEVP Chiapas', 'Tapachula', 'Chiapas', 'México');

INSERT INTO member_statuses (id, code, name, sort_order) VALUES
  ('01900000-0000-7000-8000-00000000st01', 'activo', 'Activo', 1),
  ('01900000-0000-7000-8000-00000000st02', 'suspendido', 'Suspendido', 2),
  ('01900000-0000-7000-8000-00000000st03', 'inactivo', 'Inactivo', 3),
  ('01900000-0000-7000-8000-00000000st04', 'fallecido', 'Fallecido', 4);

INSERT INTO membership_types (id, name, is_fee_exempt, sort_order) VALUES
  ('01900000-0000-7000-8000-00000000mt01', 'Titular', 0, 1);

INSERT INTO annual_fees (id, year, amount_cents) VALUES
  ('01900000-0000-7000-8000-00000000fe01', 2026, 150000);

INSERT INTO settings (key, value) VALUES
  ('member_number_format', '"M-{seq:3}"'),
  ('next_member_seq', '1'),
  ('first_control_year', '2026'),
  ('next_receipt_folio', '1');

-- Usuario inicial admin/admin con cambio de contraseña forzado (igual que el
-- escritorio). Hash PBKDF2-SHA256, 100000 iteraciones (Workers no tienen scrypt).
INSERT INTO users (id, full_name, username, password_hash, role, must_change_password) VALUES
  ('01900000-0000-7000-8000-00000000us01', 'Administrador', 'admin',
   'pbkdf2$100000$6SU3G19/jY9j54SymcLfcQ==$UCiMjPvqFK0LhstiYiy8N+P7Ya/ICkwJc0OplRZbHoI=',
   'admin', 1);
