import { z } from 'zod'
import { contract } from './core'

// Nombres estables de los dos tipos de documento usados por el visor de credencial
// (docs/05 — Victor diseña la credencial en Illustrator; el sistema solo la almacena).
export const CREDENTIAL_FRONT_NAME = 'Credencial (Anverso)'
export const CREDENTIAL_BACK_NAME = 'Credencial (Reverso)'

export const documentStatusSchema = z.enum(['pendiente', 'vigente', 'rechazado'])
// 'vencido' se deriva en el servicio (nunca se almacena) cuando vigente + expires_at pasado.
export const derivedDocumentStatusSchema = z.enum(['pendiente', 'vigente', 'rechazado', 'vencido'])

export const documentVersionSchema = z.object({
  id: z.string(),
  versionNumber: z.number(),
  originalName: z.string(),
  mimeType: z.string(),
  uploadedAt: z.string(),
  observations: z.string().nullable()
})
export type DocumentVersion = z.output<typeof documentVersionSchema>

export const memberDocumentEntrySchema = z.object({
  documentTypeId: z.string(),
  documentTypeName: z.string(),
  isRequired: z.boolean(),
  hasExpiry: z.boolean(),
  allowsMultiple: z.boolean(),
  memberDocumentId: z.string().nullable(),
  status: documentStatusSchema,
  derivedStatus: derivedDocumentStatusSchema,
  validityMonths: z.number().int().positive().nullable(),
  issuedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  hasPhysical: z.boolean(),
  physicalLocation: z.string().nullable(),
  notes: z.string().nullable(),
  versions: z.array(documentVersionSchema)
})
export type MemberDocumentEntry = z.output<typeof memberDocumentEntrySchema>

export const memberExpedienteSchema = z.object({
  entries: z.array(memberDocumentEntrySchema),
  requiredTotal: z.number(),
  requiredCompleted: z.number()
})
export type MemberExpediente = z.output<typeof memberExpedienteSchema>

export const expedienteOverviewItemSchema = z.object({
  memberId: z.string(),
  memberNumber: z.string(),
  title: z.string().nullable(),
  fullName: z.string(),
  fullNameNoTitle: z.string(),
  givenNames: z.string(),
  apellidos: z.string().nullable(),
  requiredTotal: z.number(),
  requiredCompleted: z.number(),
  uploadedTotal: z.number()
})
export type ExpedienteOverviewItem = z.output<typeof expedienteOverviewItemSchema>

export const credentialSideSchema = z.object({
  documentTypeId: z.string(),
  version: documentVersionSchema.nullable()
})

export const upcomingExpirationSchema = z.object({
  memberId: z.string(),
  memberFullName: z.string(),
  memberNumber: z.string(),
  documentTypeName: z.string(),
  expiresAt: z.string()
})
export type UpcomingExpiration = z.output<typeof upcomingExpirationSchema>

export const documentTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isRequired: z.boolean(),
  hasExpiry: z.boolean(),
  validityMonths: z.number().int().positive().nullable(),
  allowsMultiple: z.boolean(),
  sortOrder: z.number(),
  isActive: z.boolean()
})
export type DocumentType = z.output<typeof documentTypeSchema>

export const createDocumentTypeSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  description: z.string().trim().min(1).nullable().optional(),
  isRequired: z.boolean(),
  hasExpiry: z.boolean(),
  validityMonths: z.number().int().positive().nullable().optional(),
  allowsMultiple: z.boolean()
})
export type CreateDocumentTypeInput = z.output<typeof createDocumentTypeSchema>

export const updateDocumentTypeSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).nullable().optional(),
  isRequired: z.boolean().optional(),
  hasExpiry: z.boolean().optional(),
  validityMonths: z.number().int().positive().nullable().optional(),
  allowsMultiple: z.boolean().optional()
})
export type UpdateDocumentTypeInput = z.output<typeof updateDocumentTypeSchema>

export const documentsContracts = {
  listByMember: contract(
    'documents:list-by-member',
    z.object({ memberId: z.string() }),
    memberExpedienteSchema
  ),
  upload: contract(
    'documents:upload',
    z.object({ memberId: z.string(), documentTypeId: z.string() }),
    memberDocumentEntrySchema.nullable() // null si la usuaria canceló el diálogo de archivo
  ),
  setStatus: contract(
    'documents:set-status',
    z.object({ memberDocumentId: z.string(), status: documentStatusSchema }),
    memberDocumentEntrySchema
  ),
  setExpiry: contract(
    'documents:set-expiry',
    z.object({
      memberDocumentId: z.string(),
      expiresAt: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
    }),
    memberDocumentEntrySchema
  ),
  setNotes: contract(
    'documents:set-notes',
    z.object({ memberDocumentId: z.string(), notes: z.string().trim().min(1).nullable() }),
    memberDocumentEntrySchema
  ),
  setIssuedAt: contract(
    'documents:set-issued-at',
    z.object({
      memberDocumentId: z.string(),
      issuedAt: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
    }),
    memberDocumentEntrySchema
  ),
  remove: contract('documents:remove', z.object({ memberDocumentId: z.string() }), memberDocumentEntrySchema),
  getOcrStatus: contract('documents:ocr-status', z.void(), z.object({ configured: z.boolean() })),
  setOcrApiKey: contract(
    'documents:set-ocr-api-key',
    z.object({ apiKey: z.string().trim().min(1).nullable() }),
    z.object({ ok: z.literal(true) })
  ),
  detectExpiry: contract(
    'documents:detect-expiry',
    z.object({ versionId: z.string() }),
    z.object({
      ok: z.boolean(),
      candidateDate: z.string().nullable(),
      rawTextPreview: z.string().nullable(),
      error: z.string().nullable()
    })
  ),
  uploadFromPath: contract(
    'documents:upload-from-path',
    z.object({ memberId: z.string(), documentTypeId: z.string(), filePath: z.string().trim().min(1) }),
    memberDocumentEntrySchema
  ),
  setPhysical: contract(
    'documents:set-physical',
    z.object({
      memberDocumentId: z.string(),
      hasPhysical: z.boolean(),
      physicalLocation: z.string().trim().min(1).nullable()
    }),
    memberDocumentEntrySchema
  ),
  openVersion: contract(
    'documents:open-version',
    z.object({ versionId: z.string() }),
    z.object({ ok: z.literal(true) })
  ),
  downloadVersion: contract(
    'documents:download-version',
    z.object({ versionId: z.string() }),
    z.union([z.object({ saved: z.literal(true), path: z.string() }), z.object({ saved: z.literal(false) })])
  ),
  getVersionData: contract(
    'documents:get-version-data',
    z.object({ versionId: z.string() }),
    z.object({ mimeType: z.string(), dataBase64: z.string(), originalName: z.string() })
  ),
  getCredential: contract(
    'documents:get-credential',
    z.object({ memberId: z.string() }),
    z.object({ front: credentialSideSchema, back: credentialSideSchema })
  ),
  overview: contract('documents:overview', z.void(), z.array(expedienteOverviewItemSchema)),
  exportAll: contract(
    'documents:export-all',
    z.void(),
    z.object({ saved: z.boolean(), path: z.string().nullable(), memberCount: z.number() })
  ),
  upcomingExpirations: contract(
    'documents:upcoming-expirations',
    z.object({ withinDays: z.number().int().min(1).max(365) }),
    z.array(upcomingExpirationSchema)
  ),
  listTypes: contract('documents:list-types', z.void(), z.array(documentTypeSchema)),
  createType: contract('documents:create-type', createDocumentTypeSchema, documentTypeSchema),
  updateType: contract(
    'documents:update-type',
    z.object({ id: z.string(), patch: updateDocumentTypeSchema }),
    documentTypeSchema
  ),
  setTypeActive: contract(
    'documents:set-type-active',
    z.object({ id: z.string(), isActive: z.boolean() }),
    documentTypeSchema
  )
}
