import { handle } from '@main/core/ipc/registry'
import { contracts } from '@shared/contracts'
import { getDb } from '@main/core/db'
import * as s from '@main/core/db/schema'
import * as service from './assemblies.service'
import { generateAttendanceSheet, generateBlankAttendanceSheet } from './assemblies.pdf'
import { me } from '../users/users.service'

const actor = (): string | null => me()?.id ?? null

export function register(): void {
  handle(contracts.assemblies.list, () => service.listAssemblies())

  handle(contracts.assemblies.create, (input) => service.createAssembly(input, actor()))

  handle(contracts.assemblies.remove, ({ id }) => {
    service.removeAssembly(id, actor())
    return { ok: true as const }
  })

  handle(contracts.assemblies.getAttendance, ({ assemblyId }) => service.getAttendance(assemblyId))

  handle(contracts.assemblies.setAttendance, ({ assemblyId, memberId, present }) =>
    service.setAttendance(assemblyId, memberId, present, actor())
  )

  handle(contracts.assemblies.printBlankSheet, async () => {
    const org = getDb().select().from(s.organization).limit(1).get()
    const path = await generateBlankAttendanceSheet(org?.name ?? 'Colegio')
    return { saved: !!path, path }
  })

  handle(contracts.assemblies.printAttendanceSheet, async ({ assemblyId }) => {
    const org = getDb().select().from(s.organization).limit(1).get()
    const { assembly, rows } = service.getAttendanceForPrint(assemblyId)
    const path = await generateAttendanceSheet(org?.name ?? 'Colegio', assembly, rows)
    return { saved: !!path, path }
  })
}
