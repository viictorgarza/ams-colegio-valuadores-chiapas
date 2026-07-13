// Formas espejo de las respuestas del backend (cloud/server), que a su vez
// espejan los contratos del escritorio.

export type SessionUser = {
  id: string
  fullName: string
  username: string
  role: 'admin' | 'secretary'
  mustChangePassword: boolean
}

export type MemberListItem = {
  id: string
  memberNumber: string
  title: string | null
  givenNames: string
  paternalSurname: string | null
  maternalSurname: string | null
  fullName: string
  phone: string | null
  email: string | null
  statusCode: string
  statusName: string
  isPerito: boolean
}

export type MemberDetail = MemberListItem & {
  curp: string | null
  rfc: string | null
  phoneHome: string | null
  street: string | null
  city: string | null
  state: string | null
  zip: string | null
  university: string | null
  degree: string | null
  specialty: string | null
  masters: string | null
  doctorate: string | null
  company: string | null
  position: string | null
  peritoNumber: string | null
  membershipTypeName: string
  joinedAt: string | null
  observations: string | null
  createdAt: string
  updatedAt: string
}

export type StatusHistoryEntry = {
  statusCode: string
  statusName: string
  changedAt: string
  reason: string | null
  changedByName: string | null
}

export type Payment = {
  id: string
  memberId: string
  year: number
  kind: 'pago' | 'apoyo_en_especie' | 'condonacion'
  amountCents: number
  paidAt: string
  method: 'efectivo' | 'transferencia' | 'otro' | null
  concept: string | null
  reference: string | null
  receiptFolio: string | null
  observations: string | null
  createdAt: string
}

export type AnnuityStatus = 'exenta' | 'cubierta' | 'parcial' | 'pendiente'

export type MemberAnnuity = {
  memberId: string
  memberNumber: string
  title: string | null
  fullName: string
  fullNameNoTitle: string
  givenNames: string
  apellidos: string | null
  phone: string | null
  year: number
  feeCents: number
  paidCents: number
  hasInKindSupport: boolean
  status: AnnuityStatus
}

export type AnnualFee = {
  id: string
  year: number
  membershipTypeId: string | null
  amountCents: number
  notes: string | null
}

export type EventType = 'reunion' | 'asamblea' | 'ponencia' | 'otro'

export type CalendarEvent = {
  id: string
  title: string
  eventType: EventType
  startsAt: string
  endsAt: string | null
  location: string | null
  notes: string | null
  createdAt: string
}

export type Assembly = {
  id: string
  date: string
  title: string | null
  notes: string | null
  presentCount: number
}

export type AttendanceRow = {
  memberId: string
  memberNumber: string
  title: string | null
  givenNames: string
  apellidos: string | null
  phone: string | null
  present: boolean
}

export type SystemStats = {
  membersCount: number
  pendingPayments: number
  year: number
  upcomingEvents: Array<{
    id: string
    title: string
    eventType: EventType
    startsAt: string
    location: string | null
  }>
}

export type Organization = {
  name: string
  shortName: string | null
  city: string | null
  state: string | null
  phone: string | null
  email: string | null
}

export const eventTypeLabels: Record<EventType, string> = {
  reunion: 'Reunión',
  asamblea: 'Asamblea',
  ponencia: 'Ponencia',
  otro: 'Otro'
}

export const annuityStatusLabels: Record<AnnuityStatus, string> = {
  exenta: 'Exenta',
  cubierta: 'Cubierta',
  parcial: 'Parcial',
  pendiente: 'Pendiente'
}

export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
}

/** Parsea YYYY-MM-DD como fecha local (no UTC) — mismo bug corregido en el
 * escritorio: new Date('2026-08-06') sería medianoche UTC = día anterior en MX. */
export function parseLocalDate(dateStr: string): Date {
  const [datePart, timePart] = dateStr.split('T')
  const [y, m, d] = datePart!.split('-').map(Number)
  if (timePart) {
    const [hh, mm] = timePart.split(':').map(Number)
    return new Date(y!, m! - 1, d!, hh ?? 0, mm ?? 0)
  }
  return new Date(y!, m! - 1, d!)
}

export function formatDate(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

export function formatDateShort(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatTime(dateStr: string): string {
  if (!dateStr.includes('T')) return ''
  return parseLocalDate(dateStr).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })
}
