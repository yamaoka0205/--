import type { ListReservationsResponse, Store, StoreFaq, StoreHours } from './types'

const TOKEN_KEY = 'bookingapp.accessToken'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export type AuthSession = {
  status: string
  userId: string
  tenantId: string
  displayName: string
  email: string
  role: string
  storeName?: string
  accessToken?: string
}

function baseUrl(): string {
  if (import.meta.env.DEV) return '/api'
  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')
  if (!fromEnv) {
    throw new Error('VITE_API_BASE_URL is required for production builds')
  }
  return fromEnv
}

async function post<T>(
  path: string,
  body: Record<string, unknown> = {},
  opts?: { auth?: boolean },
): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (opts?.auth !== false) {
    const token = getStoredToken()
    if (token) headers.authorization = `Bearer ${token}`
  }
  const res = await fetch(`${baseUrl()}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as T & { status?: string; reason?: string }
  if (!res.ok) {
    const reason = data?.reason || data?.status || res.statusText
    throw new Error(String(reason))
  }
  return data
}

export function login(email: string, password: string) {
  return post<AuthSession & { accessToken: string; storeName?: string }>(
    '/auth/login',
    { email, password },
    { auth: false },
  )
}

export function logout() {
  return post<{ status: string }>('/auth/logout', {})
}

export function authMe() {
  return post<AuthSession>('/auth/me', {})
}

export function listReservations(date: string) {
  return post<ListReservationsResponse>('/reservations/list', { date })
}

export function getStore() {
  return post<Store>('/store/get', {})
}

export function updateStore(input: {
  name?: string
  standardDurationMin?: number
  hours?: StoreHours[]
  faqs?: StoreFaq[]
}) {
  return post<Store>('/store/update', { ...input })
}

export function checkAvailability(input: {
  date: string
  startTime: string
  partySize: number
}) {
  return post<{
    status: string
    endTime?: string
    tableId?: string
    reason?: string
    standardDurationMin?: number
  }>('/availability/check', {
    date: input.date,
    startTime: input.startTime,
    partySize: input.partySize,
  })
}

export function confirmReservation(input: {
  date: string
  startTime: string
  partySize: number
  customerName: string
  customerPhone?: string
}) {
  return post<{
    status: string
    reservationId?: string
    endTime?: string
    tableId?: string
    reason?: string
  }>('/reservations/confirm', {
    date: input.date,
    startTime: input.startTime,
    partySize: input.partySize,
    customerName: input.customerName,
    customerPhone: input.customerPhone || undefined,
    source: 'manual',
  })
}
