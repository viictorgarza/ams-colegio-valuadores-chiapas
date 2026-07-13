import type {
  AnnualFee,
  Assembly,
  AttendanceRow,
  CalendarEvent,
  EventType,
  MemberAnnuity,
  MemberDetail,
  MemberListItem,
  Organization,
  Payment,
  SessionUser,
  StatusHistoryEntry,
  SystemStats
} from './types'

const TOKEN_KEY = 'ams_token'

let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    })
  } catch {
    throw new Error('Sin conexión a internet. Intenta de nuevo cuando tengas señal.')
  }

  if (res.status === 401 && !path.startsWith('/auth/login')) {
    setToken(null)
    onUnauthorized?.()
  }
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new Error(data?.error ?? `Error del servidor (${res.status})`)
  return data as T
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; user: SessionUser }>('POST', '/auth/login', { username, password }),
  logout: () => request<{ ok: true }>('POST', '/auth/logout'),
  me: () => request<{ user: SessionUser }>('GET', '/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('POST', '/auth/change-password', { currentPassword, newPassword }),

  members: {
    list: (search?: string, statusCode?: string) => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusCode) params.set('statusCode', statusCode)
      const qs = params.toString()
      return request<MemberListItem[]>('GET', `/members${qs ? `?${qs}` : ''}`)
    },
    get: (id: string) => request<MemberDetail>('GET', `/members/${id}`),
    history: (id: string) => request<StatusHistoryEntry[]>('GET', `/members/${id}/history`),
    payments: (id: string) => request<Payment[]>('GET', `/members/${id}/payments`),
    create: (input: {
      title?: string | null
      givenNames: string
      paternalSurname?: string | null
      maternalSurname?: string | null
      phone?: string | null
    }) => request<MemberDetail>('POST', '/members', input),
    update: (id: string, patch: Record<string, unknown>) => request<MemberDetail>('PATCH', `/members/${id}`, patch),
    changeStatus: (id: string, statusCode: string, reason?: string | null) =>
      request<MemberDetail>('POST', `/members/${id}/status`, { statusCode, reason }),
    remove: (id: string) => request<{ ok: true }>('DELETE', `/members/${id}`)
  },

  payments: {
    annuities: (year: number) => request<MemberAnnuity[]>('GET', `/payments/annuities?year=${year}`),
    getFee: (year: number) => request<AnnualFee | null>('GET', `/payments/annual-fee?year=${year}`),
    setFee: (year: number, amountCents: number) =>
      request<AnnualFee>('PUT', '/payments/annual-fee', { year, amountCents }),
    create: (input: {
      memberId: string
      year: number
      kind: Payment['kind']
      amountCents: number
      paidAt: string
      method: Payment['method']
      concept?: string | null
      reference?: string | null
      observations?: string | null
    }) => request<Payment>('POST', '/payments', input),
    remove: (id: string) => request<{ ok: true }>('DELETE', `/payments/${id}`)
  },

  events: {
    list: () => request<CalendarEvent[]>('GET', '/events'),
    create: (input: {
      title: string
      eventType: EventType
      startsAt: string
      endsAt?: string | null
      location?: string | null
      notes?: string | null
    }) => request<CalendarEvent>('POST', '/events', input),
    update: (id: string, patch: Record<string, unknown>) => request<CalendarEvent>('PATCH', `/events/${id}`, patch),
    remove: (id: string) => request<{ ok: true }>('DELETE', `/events/${id}`)
  },

  assemblies: {
    list: () => request<Assembly[]>('GET', '/assemblies'),
    create: (input: { date: string; title?: string | null; notes?: string | null }) =>
      request<Assembly>('POST', '/assemblies', input),
    attendance: (id: string) => request<AttendanceRow[]>('GET', `/assemblies/${id}/attendance`),
    setAttendance: (id: string, memberId: string, present: boolean) =>
      request<{ ok: true }>('PUT', `/assemblies/${id}/attendance`, { memberId, present }),
    remove: (id: string) => request<{ ok: true }>('DELETE', `/assemblies/${id}`)
  },

  system: {
    stats: () => request<SystemStats>('GET', '/system/stats'),
    organization: () => request<Organization | null>('GET', '/system/organization')
  }
}
