import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// Convenciones (docs/03-modelo-datos.md §2): UUID v7 como PK, timestamps ISO-8601 UTC,
// borrado lógico con deleted_at, dinero en centavos (enteros).

const id = () => text('id').primaryKey()
const createdAt = () => text('created_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)
const updatedAt = () => text('updated_at').notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)
const deletedAt = () => text('deleted_at')
const bool = (name: string) => integer(name, { mode: 'boolean' })

export const users = sqliteTable('users', {
  id: id(),
  fullName: text('full_name').notNull(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'secretary'] }).notNull(),
  isActive: bool('is_active').notNull().default(true),
  mustChangePassword: bool('must_change_password').notNull().default(false),
  lastLoginAt: text('last_login_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: deletedAt()
})

export const files = sqliteTable('files', {
  id: id(),
  sha256: text('sha256').notNull().unique(),
  sizeBytes: integer('size_bytes').notNull(),
  mimeType: text('mime_type').notNull(),
  originalName: text('original_name').notNull(),
  createdBy: text('created_by').references(() => users.id),
  createdAt: createdAt()
})

export const organization = sqliteTable('organization', {
  id: id(),
  name: text('name').notNull(),
  shortName: text('short_name'),
  rfc: text('rfc'),
  street: text('street'),
  city: text('city'),
  state: text('state'),
  zip: text('zip'),
  country: text('country'),
  phone: text('phone'),
  email: text('email'),
  website: text('website'),
  fiscalNotes: text('fiscal_notes'),
  logoFileId: text('logo_file_id').references(() => files.id),
  createdAt: createdAt(),
  updatedAt: updatedAt()
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull() // JSON
})

export const importBatches = sqliteTable('import_batches', {
  id: id(),
  sourceName: text('source_name').notNull(),
  importedAt: text('imported_at').notNull(),
  userId: text('user_id').references(() => users.id),
  statsJson: text('stats_json')
})

export const membershipTypes = sqliteTable('membership_types', {
  id: id(),
  name: text('name').notNull(),
  description: text('description'),
  isFeeExempt: bool('is_fee_exempt').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: bool('is_active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt()
})

export const memberStatuses = sqliteTable('member_statuses', {
  id: id(),
  code: text('code').notNull().unique(), // estable, usado por la lógica
  name: text('name').notNull(), // visible, editable
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: bool('is_active').notNull().default(true)
})

export const members = sqliteTable(
  'members',
  {
    id: id(),
    memberNumber: text('member_number').notNull(),
    title: text('title'), // Ing., Arq., Lic., …
    givenNames: text('given_names').notNull(),
    paternalSurname: text('paternal_surname'),
    maternalSurname: text('maternal_surname'),
    fullName: text('full_name').notNull(), // mantenida por el servicio al escribir
    photoFileId: text('photo_file_id').references(() => files.id),
    curp: text('curp'),
    rfc: text('rfc'),
    email: text('email'),
    phone: text('phone'), // celular
    phoneHome: text('phone_home'), // teléfono de casa
    street: text('street'),
    city: text('city'),
    state: text('state'),
    zip: text('zip'),
    university: text('university'),
    degree: text('degree'), // carrera
    specialty: text('specialty'),
    masters: text('masters'),
    doctorate: text('doctorate'),
    company: text('company'),
    position: text('position'),
    isPerito: bool('is_perito').notNull().default(false),
    peritoNumber: text('perito_number'),
    membershipTypeId: text('membership_type_id')
      .notNull()
      .references(() => membershipTypes.id),
    statusId: text('status_id')
      .notNull()
      .references(() => memberStatuses.id),
    joinedAt: text('joined_at'), // fecha de ingreso (YYYY-MM-DD)
    observations: text('observations'),
    importBatchId: text('import_batch_id').references(() => importBatches.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt()
  },
  (t) => [
    uniqueIndex('uq_members_member_number').on(t.memberNumber),
    uniqueIndex('uq_members_curp').on(t.curp),
    index('idx_members_full_name').on(t.fullName),
    index('idx_members_status').on(t.statusId)
  ]
)

export const memberStatusHistory = sqliteTable(
  'member_status_history',
  {
    id: id(),
    memberId: text('member_id')
      .notNull()
      .references(() => members.id),
    statusId: text('status_id')
      .notNull()
      .references(() => memberStatuses.id),
    changedAt: text('changed_at').notNull(),
    reason: text('reason'),
    changedBy: text('changed_by').references(() => users.id)
  },
  (t) => [index('idx_msh_member').on(t.memberId)]
)

export const documentTypes = sqliteTable('document_types', {
  id: id(),
  name: text('name').notNull(),
  description: text('description'),
  isRequired: bool('is_required').notNull().default(false), // define la barra de progreso
  hasExpiry: bool('has_expiry').notNull().default(false),
  // Meses de vigencia desde la fecha de emisión (NULL = se sigue capturando "vigente hasta" a mano).
  validityMonths: integer('validity_months'),
  allowsMultiple: bool('allows_multiple').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: bool('is_active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt()
})

export const memberDocuments = sqliteTable(
  'member_documents',
  {
    id: id(),
    memberId: text('member_id')
      .notNull()
      .references(() => members.id),
    documentTypeId: text('document_type_id')
      .notNull()
      .references(() => documentTypes.id),
    // 'vencido' nunca se almacena: se deriva de expires_at (docs/03 §4.3)
    status: text('status', { enum: ['pendiente', 'vigente', 'rechazado'] })
      .notNull()
      .default('pendiente'),
    issuedAt: text('issued_at'), // fecha de emisión; si el tipo tiene validityMonths, calcula expiresAt sola
    expiresAt: text('expires_at'),
    hasPhysical: bool('has_physical').notNull().default(false),
    physicalLocation: text('physical_location'),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt()
  },
  (t) => [index('idx_mdocs_member').on(t.memberId)]
)

export const documentVersions = sqliteTable(
  'document_versions',
  {
    id: id(),
    memberDocumentId: text('member_document_id')
      .notNull()
      .references(() => memberDocuments.id),
    versionNumber: integer('version_number').notNull(),
    fileId: text('file_id')
      .notNull()
      .references(() => files.id),
    uploadedBy: text('uploaded_by').references(() => users.id),
    uploadedAt: text('uploaded_at').notNull(),
    observations: text('observations')
  },
  (t) => [index('idx_dver_mdoc').on(t.memberDocumentId)]
)

export const annualFees = sqliteTable(
  'annual_fees',
  {
    id: id(),
    year: integer('year').notNull(),
    membershipTypeId: text('membership_type_id').references(() => membershipTypes.id), // NULL = cuota general
    amountCents: integer('amount_cents').notNull(),
    notes: text('notes'),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (t) => [index('idx_fees_year').on(t.year)]
)

export const payments = sqliteTable(
  'payments',
  {
    id: id(),
    memberId: text('member_id')
      .notNull()
      .references(() => members.id),
    year: integer('year').notNull(), // año de anualidad que cubre
    kind: text('kind', { enum: ['pago', 'apoyo_en_especie', 'condonacion'] })
      .notNull()
      .default('pago'),
    amountCents: integer('amount_cents').notNull().default(0),
    paidAt: text('paid_at').notNull(), // YYYY-MM-DD
    method: text('method', { enum: ['efectivo', 'transferencia', 'otro'] }),
    // Concepto libre para pagos que NO son la cuota anual (ej. "curso", "credencial").
    // NULL = cuota anual del año indicado (cuenta para el estado de anualidad).
    concept: text('concept'),
    reference: text('reference'),
    receiptFolio: text('receipt_folio'),
    receiptFileId: text('receipt_file_id').references(() => files.id),
    observations: text('observations'),
    createdBy: text('created_by').references(() => users.id),
    importBatchId: text('import_batch_id').references(() => importBatches.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt()
  },
  (t) => [index('idx_payments_member_year').on(t.memberId, t.year), index('idx_payments_year').on(t.year)]
)

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: id(),
    userId: text('user_id'),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    beforeJson: text('before_json'),
    afterJson: text('after_json'),
    device: text('device'),
    createdAt: createdAt()
  },
  (t) => [index('idx_audit_created').on(t.createdAt), index('idx_audit_entity').on(t.entityType, t.entityId)]
)

export const events = sqliteTable(
  'events',
  {
    id: id(),
    title: text('title').notNull(),
    eventType: text('event_type', { enum: ['reunion', 'asamblea', 'ponencia', 'otro'] })
      .notNull()
      .default('otro'),
    startsAt: text('starts_at').notNull(), // ISO 8601 con hora
    endsAt: text('ends_at'),
    location: text('location'),
    notes: text('notes'),
    createdBy: text('created_by').references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt()
  },
  (t) => [index('idx_events_starts_at').on(t.startsAt)]
)

export const backupLog = sqliteTable('backup_log', {
  id: id(),
  destination: text('destination', { enum: ['local', 'usb', 'r2'] }).notNull(),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  sizeBytes: integer('size_bytes'),
  sha256: text('sha256'),
  status: text('status', { enum: ['en_curso', 'ok', 'error'] }).notNull(),
  error: text('error')
})

// Control de asistencias (docs/05 — diseño acordado 2026-07-12, construido junto
// con el resto de julio). Una asamblea por reunión mensual (fecha tentativa,
// primer jueves del mes, a veces cambia); la lista de asistentes es la de
// members activos, no se dan de alta aparte.
export const assemblies = sqliteTable('assemblies', {
  id: id(),
  date: text('date').notNull(), // YYYY-MM-DD
  title: text('title'),
  notes: text('notes'),
  createdBy: text('created_by').references(() => users.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: deletedAt()
})

export const attendanceRecords = sqliteTable(
  'attendance_records',
  {
    id: id(),
    assemblyId: text('assembly_id')
      .notNull()
      .references(() => assemblies.id),
    memberId: text('member_id')
      .notNull()
      .references(() => members.id),
    present: bool('present').notNull().default(false),
    markedAt: text('marked_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  (t) => [
    uniqueIndex('uq_attendance_assembly_member').on(t.assemblyId, t.memberId),
    index('idx_attendance_assembly').on(t.assemblyId)
  ]
)
