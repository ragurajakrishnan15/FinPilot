// Single entry point for server data. Pages import `api` from here.
// VITE_USE_MOCK=true selects in-memory synthetic data (used by unit tests and offline UI work).
import { httpApi } from './httpApi'
import { __resetMockState, mockApi } from './mockApi'

export { ApiError } from './errors'
export { __resetMockState }

const useMock = (import.meta.env.VITE_USE_MOCK as string | undefined) === 'true'

export const api: typeof mockApi = useMock ? mockApi : (httpApi as unknown as typeof mockApi)
export const isMockApi = useMock
