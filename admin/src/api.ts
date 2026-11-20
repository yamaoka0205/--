import type { ListReservationsResponse, Store, StoreFaq, StoreHours } from './types'

export const DEMO_TENANT_ID = 't_demo_001'

function baseUrl(): string {
  // In dev, always go through Vite proxy (/api → API Gateway) to avoid CORS hassle.
  if (import.meta.env.DEV) return '/api'
  const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')
  if (!fromEnv) {
    throw new Error('VITE_API_BASE_URL is required for production builds')
  }
  return fromEnv
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as T & { status?: string; reason?: string }
  if (!res.ok) {
    const reason = data?.reason || data?.status || res.statusText
    throw new Error(String(reason))
  }
  return data
}

export function listReservations(date: string, tenantId = DEMO_TENANT_ID) {
  return post<ListReservationsResponse>('/reservations/list', { tenantId, date })
}

export function getStore(tenantId = DEMO_TENANT_ID) {
  return post<Store>('/store/get', { tenantId })
}

export function updateStore(input: {
  tenantId?: string
  name?: string
  standardDurationMin?: number
  hours?: StoreHours[]
  faqs?: StoreFaq[]
}) {
  return post<Store>('/store/update', {
    tenantId: input.tenantId || DEMO_TENANT_ID,
    ...input,
  })
}

export function checkAvailability(input: {
  date: string
  startTime: string
  partySize: number
  tenantId?: string
}) {
  return post<{
    status: string
    endTime?: string
    tableId?: string
    reason?: string
    standardDurationMin?: number
  }>('/availability/check', {
    tenantId: input.tenantId || DEMO_TENANT_ID,
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
  tenantId?: string
}) {
  return post<{
    status: string
    reservationId?: string
    endTime?: string
    tableId?: string
    reason?: string
  }>('/reservations/confirm', {
    tenantId: input.tenantId || DEMO_TENANT_ID,
    date: input.date,
    startTime: input.startTime,
    partySize: input.partySize,
    customerName: input.customerName,
    customerPhone: input.customerPhone || undefined,
    source: 'manual',
  })
}
