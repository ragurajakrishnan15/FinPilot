import type { ApiErrorBody } from '@/types/api'
import { ApiError } from './errors'

export const BASE: string = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8080'

// The token is a short-lived demo-session JWT held in memory only (never localStorage).
let token: string | undefined
let inflight: Promise<string> | undefined

async function fetchDemoToken(): Promise<string> {
  const res = await fetch(`${BASE}/api/demo-session`, { method: 'POST' })
  if (!res.ok) throw new ApiError('unauthorized', 'Could not start a demo session')
  return ((await res.json()) as { token: string }).token
}

async function ensureToken(): Promise<string> {
  if (token) return token
  inflight ??= fetchDemoToken().finally(() => {
    inflight = undefined
  })
  token = await inflight
  return token
}

export function __clearToken() {
  token = undefined
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as Partial<ApiErrorBody>
    // Surface field-level validation messages when the server provides them.
    const detail = body.details ? Object.values(body.details).join('; ') : ''
    return new ApiError(body.code ?? 'error', detail || (body.message ?? 'Request failed'), body.details)
  } catch {
    return new ApiError('error', `Request failed (${res.status})`)
  }
}

export async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const t = await ensureToken()
    let res: Response
    try {
      res = await fetch(`${BASE}${path}`, {
        method: init.method ?? 'GET',
        headers: {
          Authorization: `Bearer ${t}`,
          ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      })
    } catch {
      throw new ApiError('network_error', 'Cannot reach the server. Check your connection and try again.')
    }
    if (res.status === 401 && attempt === 0) {
      token = undefined // expired: get a fresh demo session and retry once
      continue
    }
    if (!res.ok) throw await parseError(res)
    return (await res.json()) as T
  }
  throw new ApiError('unauthorized', 'Authentication required')
}

export function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  const s = sp.toString()
  return s ? `?${s}` : ''
}
