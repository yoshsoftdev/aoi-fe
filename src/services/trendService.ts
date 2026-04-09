import axios from 'axios'

// Separate API client for trend service (Trans-Data HTTP API on port 8072)
const getTrendApiBaseURL = (): string => {
  // Prefer explicit env in development/production
  if (import.meta.env.VITE_TREND_API_URL && import.meta.env.VITE_TREND_API_URL !== '') {
    return import.meta.env.VITE_TREND_API_URL
  }

  // In both dev + prod, prefer going through Vite/Nginx proxy.
  // Backend endpoints are documented as:
  //   GET /minutes, /hours, /days (no `/trend-api` prefix)
  if (!import.meta.env.DEV) {
    return "/trend-api"
  }

  // Fallback:
  // - local dev: localhost:8072
  // - embedded/edge: use the current hostname, same port (8072)
  //   (matches bahan/trend.md idea "sesuaikan host/IP edge device")
  if (import.meta.env.DEV) {
    // In dev, route requests through Vite proxy (see `vite.config.ts`)
    // so we don't depend on the browser reaching `:8072` directly.
    return "/trend-api"
  }

  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https:' : 'http:'

  if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `${protocol}//${hostname}:8072`
  }

  return 'http://localhost:8072'
}

const TREND_API_BASE_URL = getTrendApiBaseURL()

if (import.meta.env.DEV) {
  console.log('[TREND API] Base URL:', TREND_API_BASE_URL)
}

const trendApi = axios.create({
  baseURL: TREND_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface MinutePoint {
  id_param: number
  min_value: number
  max_value: number
  avg_value: number
  data_count: number
  period_start: string
  period_end: string
  created_at: string
}

export interface HourPoint extends MinutePoint {}
export interface DayPoint extends MinutePoint {}

export const trendService = {
  // Per menit: always last 1 hour for given param_id
  getMinutes: async (paramId: number): Promise<MinutePoint[]> => {
    const res = await trendApi.get('/minutes', {
      params: { param_id: paramId },
    })
    // API returns raw array, no wrapper
    return res.data || []
  },

  // Per jam, optional from/to (RFC3339)
  getHours: async (paramId: number, from?: string, to?: string): Promise<HourPoint[]> => {
    const params: Record<string, string | number> = { param_id: paramId }
    if (from) params.from = from
    if (to) params.to = to
    const res = await trendApi.get('/hours', { params })
    return res.data || []
  },

  // Per hari, optional from/to (RFC3339)
  getDays: async (paramId: number, from?: string, to?: string): Promise<DayPoint[]> => {
    const params: Record<string, string | number> = { param_id: paramId }
    if (from) params.from = from
    if (to) params.to = to
    const res = await trendApi.get('/days', { params })
    return res.data || []
  },
}

