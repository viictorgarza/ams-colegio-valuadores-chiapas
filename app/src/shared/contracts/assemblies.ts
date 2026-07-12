import { z } from 'zod'
import { contract } from './core'

export const assemblySchema = z.object({
  id: z.string(),
  date: z.string(),
  title: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  presentCount: z.number()
})
export type Assembly = z.output<typeof assemblySchema>

export const createAssemblySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(1).nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional()
})
export type CreateAssemblyInput = z.output<typeof createAssemblySchema>

export const attendanceRowSchema = z.object({
  memberId: z.string(),
  memberNumber: z.string(),
  title: z.string().nullable(),
  apellidos: z.string().nullable(),
  givenNames: z.string(),
  present: z.boolean()
})
export type AttendanceRow = z.output<typeof attendanceRowSchema>

export const assembliesContracts = {
  list: contract('assemblies:list', z.void(), z.array(assemblySchema)),
  create: contract('assemblies:create', createAssemblySchema, assemblySchema),
  remove: contract('assemblies:remove', z.object({ id: z.string() }), z.object({ ok: z.literal(true) })),
  getAttendance: contract(
    'assemblies:get-attendance',
    z.object({ assemblyId: z.string() }),
    z.object({ assembly: assemblySchema, rows: z.array(attendanceRowSchema) })
  ),
  setAttendance: contract(
    'assemblies:set-attendance',
    z.object({ assemblyId: z.string(), memberId: z.string(), present: z.boolean() }),
    attendanceRowSchema
  ),
  printBlankSheet: contract(
    'assemblies:print-blank-sheet',
    z.void(),
    z.object({ saved: z.boolean(), path: z.string().nullable() })
  ),
  printAttendanceSheet: contract(
    'assemblies:print-attendance-sheet',
    z.object({ assemblyId: z.string() }),
    z.object({ saved: z.boolean(), path: z.string().nullable() })
  )
}
