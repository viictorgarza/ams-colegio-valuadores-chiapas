import type { z } from 'zod'
import { contracts, type Contract } from '@shared/contracts'

/**
 * Cliente IPC tipado: se construye a partir de los mismos contratos que
 * implementa el main. Valida entrada y salida también de este lado.
 */
function caller<I extends z.ZodType, O extends z.ZodType>(c: Contract<I, O>) {
  return async (input: z.input<I>): Promise<z.output<O>> => {
    const parsed = c.input.parse(input)
    const result = await window.ams.invoke(c.channel, parsed)
    return c.output.parse(result)
  }
}

export const api = {
  auth: {
    login: caller(contracts.auth.login),
    me: caller(contracts.auth.me),
    logout: caller(contracts.auth.logout),
    changePassword: caller(contracts.auth.changePassword)
  },
  organization: {
    get: caller(contracts.organization.get),
    update: caller(contracts.organization.update),
    uploadLogo: caller(contracts.organization.uploadLogo),
    getLogo: caller(contracts.organization.getLogo),
    removeLogo: caller(contracts.organization.removeLogo)
  },
  system: {
    info: caller(contracts.system.info),
    firstRunPending: caller(contracts.system.firstRunPending),
    completeFirstRun: caller(contracts.system.completeFirstRun),
    getAutoLockMinutes: caller(contracts.system.getAutoLockMinutes),
    setAutoLockMinutes: caller(contracts.system.setAutoLockMinutes)
  },
  users: {
    list: caller(contracts.users.list),
    create: caller(contracts.users.create),
    setActive: caller(contracts.users.setActive)
  },
  members: {
    list: caller(contracts.members.list),
    get: caller(contracts.members.get),
    create: caller(contracts.members.create),
    update: caller(contracts.members.update),
    changeStatus: caller(contracts.members.changeStatus),
    remove: caller(contracts.members.remove),
    exportExcel: caller(contracts.members.exportExcel)
  },
  catalogs: {
    memberStatuses: caller(contracts.catalogs.memberStatuses),
    membershipTypes: caller(contracts.catalogs.membershipTypes),
    lookupZip: caller(contracts.catalogs.lookupZip)
  },
  payments: {
    annuitiesByYear: caller(contracts.payments.annuitiesByYear),
    listByMember: caller(contracts.payments.listByMember),
    create: caller(contracts.payments.create),
    remove: caller(contracts.payments.remove),
    openReceipt: caller(contracts.payments.openReceipt),
    downloadReceipt: caller(contracts.payments.downloadReceipt),
    getAnnualFee: caller(contracts.payments.getAnnualFee),
    setAnnualFee: caller(contracts.payments.setAnnualFee)
  },
  documents: {
    listByMember: caller(contracts.documents.listByMember),
    upload: caller(contracts.documents.upload),
    uploadFromPath: caller(contracts.documents.uploadFromPath),
    setStatus: caller(contracts.documents.setStatus),
    setExpiry: caller(contracts.documents.setExpiry),
    setIssuedAt: caller(contracts.documents.setIssuedAt),
    setNotes: caller(contracts.documents.setNotes),
    remove: caller(contracts.documents.remove),
    setPhysical: caller(contracts.documents.setPhysical),
    openVersion: caller(contracts.documents.openVersion),
    downloadVersion: caller(contracts.documents.downloadVersion),
    getVersionData: caller(contracts.documents.getVersionData),
    getCredential: caller(contracts.documents.getCredential),
    overview: caller(contracts.documents.overview),
    exportAll: caller(contracts.documents.exportAll),
    upcomingExpirations: caller(contracts.documents.upcomingExpirations),
    listTypes: caller(contracts.documents.listTypes),
    createType: caller(contracts.documents.createType),
    updateType: caller(contracts.documents.updateType),
    setTypeActive: caller(contracts.documents.setTypeActive),
    getOcrStatus: caller(contracts.documents.getOcrStatus),
    setOcrApiKey: caller(contracts.documents.setOcrApiKey),
    detectExpiry: caller(contracts.documents.detectExpiry)
  },
  backups: {
    create: caller(contracts.backups.create),
    restore: caller(contracts.backups.restore),
    getLast: caller(contracts.backups.getLast),
    getCloudConfig: caller(contracts.backups.getCloudConfig),
    setCloudConfig: caller(contracts.backups.setCloudConfig),
    testCloudConnection: caller(contracts.backups.testCloudConnection),
    createCloudBackup: caller(contracts.backups.createCloudBackup),
    getLastCloudBackup: caller(contracts.backups.getLastCloudBackup),
    generateRecoveryKit: caller(contracts.backups.generateRecoveryKit)
  },
  events: {
    list: caller(contracts.events.list),
    create: caller(contracts.events.create),
    update: caller(contracts.events.update),
    remove: caller(contracts.events.remove)
  },
  assemblies: {
    list: caller(contracts.assemblies.list),
    create: caller(contracts.assemblies.create),
    remove: caller(contracts.assemblies.remove),
    getAttendance: caller(contracts.assemblies.getAttendance),
    setAttendance: caller(contracts.assemblies.setAttendance),
    printBlankSheet: caller(contracts.assemblies.printBlankSheet),
    printAttendanceSheet: caller(contracts.assemblies.printAttendanceSheet)
  },
  trash: {
    list: caller(contracts.trash.list),
    restore: caller(contracts.trash.restore)
  }
}
