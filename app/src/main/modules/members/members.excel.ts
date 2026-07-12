import { app, BrowserWindow, dialog } from 'electron'
import ExcelJS from 'exceljs'
import { join } from 'node:path'
import { and, asc, eq, inArray, isNull, type SQL } from 'drizzle-orm'
import { getDb } from '@main/core/db'
import * as s from '@main/core/db/schema'
import { bus } from '@main/core/events/bus'
import type { MemberFilters } from '@shared/contracts'
import { listMembers } from './members.service'

export type ExportResult = { saved: true; path: string; count: number } | { saved: false }

/** Exporta el listado filtrado a un .xlsx elegido por la usuaria. */
export async function exportMembersToExcel(
  filters: MemberFilters,
  actorId: string | null
): Promise<ExportResult> {
  // Mismos criterios que la lista visible: se exporta lo que se ve.
  const visible = listMembers(filters)
  const ids = visible.map((m) => m.id)

  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const today = new Date().toISOString().slice(0, 10)
  const pick = await dialog.showSaveDialog(win!, {
    title: 'Exportar miembros a Excel',
    defaultPath: join(app.getPath('documents'), `Miembros_${today}.xlsx`),
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  })
  if (pick.canceled || !pick.filePath) return { saved: false }

  const conds: SQL[] = [isNull(s.members.deletedAt)]
  if (ids.length > 0) conds.push(inArray(s.members.id, ids))
  const rows =
    ids.length === 0
      ? []
      : getDb()
          .select({
            member: s.members,
            statusName: s.memberStatuses.name
          })
          .from(s.members)
          .innerJoin(s.memberStatuses, eq(s.members.statusId, s.memberStatuses.id))
          .where(and(...conds))
          .orderBy(asc(s.members.fullName))
          .all()

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Miembros')
  sheet.columns = [
    { header: 'Número', key: 'memberNumber', width: 10 },
    { header: 'Título', key: 'title', width: 8 },
    { header: 'Nombre(s)', key: 'givenNames', width: 22 },
    { header: 'Apellido paterno', key: 'paternalSurname', width: 20 },
    { header: 'Apellido materno', key: 'maternalSurname', width: 20 },
    { header: 'Nombre completo', key: 'fullName', width: 42 },
    { header: 'Celular', key: 'phone', width: 14 },
    { header: 'Tel. casa', key: 'phoneHome', width: 14 },
    { header: 'Correo', key: 'email', width: 28 },
    { header: 'CURP', key: 'curp', width: 20 },
    { header: 'RFC', key: 'rfc', width: 16 },
    { header: 'Calle y número', key: 'street', width: 30 },
    { header: 'C.P.', key: 'zip', width: 10 },
    { header: 'Ciudad', key: 'city', width: 20 },
    { header: 'Estado', key: 'state', width: 16 },
    { header: 'Estatus', key: 'statusName', width: 12 },
    { header: 'Perito', key: 'perito', width: 8 },
    { header: 'No. registro perito', key: 'peritoNumber', width: 16 },
    { header: 'Universidad', key: 'university', width: 24 },
    { header: 'Carrera', key: 'degree', width: 22 },
    { header: 'Especialidad', key: 'specialty', width: 22 },
    { header: 'Maestría', key: 'masters', width: 22 },
    { header: 'Doctorado', key: 'doctorate', width: 22 },
    { header: 'Empresa', key: 'company', width: 24 },
    { header: 'Cargo', key: 'position', width: 20 },
    { header: 'Fecha de ingreso', key: 'joinedAt', width: 14 },
    { header: 'Observaciones', key: 'observations', width: 34 }
  ]
  sheet.getRow(1).font = { bold: true }
  for (const r of rows) {
    sheet.addRow({
      memberNumber: r.member.memberNumber,
      title: r.member.title,
      givenNames: r.member.givenNames,
      paternalSurname: r.member.paternalSurname,
      maternalSurname: r.member.maternalSurname,
      fullName: r.member.fullName,
      phone: r.member.phone,
      phoneHome: r.member.phoneHome,
      email: r.member.email,
      curp: r.member.curp,
      rfc: r.member.rfc,
      street: r.member.street,
      zip: r.member.zip,
      city: r.member.city,
      state: r.member.state,
      statusName: r.statusName,
      perito: r.member.isPerito ? 'Sí' : 'No',
      peritoNumber: r.member.peritoNumber,
      university: r.member.university,
      degree: r.member.degree,
      specialty: r.member.specialty,
      masters: r.member.masters,
      doctorate: r.member.doctorate,
      company: r.member.company,
      position: r.member.position,
      joinedAt: r.member.joinedAt,
      observations: r.member.observations
    })
  }

  await workbook.xlsx.writeFile(pick.filePath)
  bus.emit('members.exported', { actorId, count: rows.length, path: pick.filePath })
  return { saved: true, path: pick.filePath, count: rows.length }
}
